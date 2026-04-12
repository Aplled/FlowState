/**
 * The ASB (Auto-Sort Bucket) router decides which workspace a new node
 * belongs to AND which existing nodes it's semantically connected to.
 *
 * Three layers, in order of precedence:
 *   1. Learned classifier head (logistic regression on embeddings),
 *      activates after MIN_SAMPLES_TO_ACTIVATE accept events.
 *   2. Embedding similarity vs workspace centroid + k-NN voting.
 *   3. Heuristic sorter (keyword/tag/type/name matching) as fallback.
 *
 * The same per-node embeddings power the connection-detection feature:
 * for any node we can find the top-K nearest existing nodes across the
 * whole graph and propose connections.
 */

import type { FlowNode, Workspace } from '@/types/database'
import {
  embedNode,
  embedNodes,
  embedText,
  cosine,
  meanVector,
  type Embedding,
} from '@/services/embeddings'
import { OnlineClassifier } from '@/lib/online-classifier'
import { sortNode as heuristicSort } from '@/lib/asb-sorter'

export interface ConnectionSuggestion {
  target_node_id: string
  target_workspace_id: string
  score: number
  reason: string
}

export interface RouteResult {
  workspace_id: string
  confidence: number
  reason: string
  source: 'classifier' | 'embedding' | 'heuristic'
  suggested_connections: ConnectionSuggestion[]
  /** Optional existing grouple (project) node the dump should be parented to. */
  suggested_parent_id: string | null
}

const KNN_K = 5
const CONNECTION_AUTO_THRESHOLD = 0.42
const CONNECTION_SUGGEST_THRESHOLD = 0.18
const MAX_SUGGESTED_CONNECTIONS = 5
const GROUPLE_PARENT_THRESHOLD = 0.45

// In-memory cache of workspace-name embeddings so we don't re-embed on every
// routing call. Keyed by `${id}:${name}` so a rename invalidates automatically.
const wsNameCache = new Map<string, Float32Array>()
async function embedWorkspaceName(ws: Workspace): Promise<Float32Array> {
  const key = `${ws.id}:${ws.name}`
  const hit = wsNameCache.get(key)
  if (hit) return hit
  const vec = await embedText(`workspace ${ws.name}`)
  wsNameCache.set(key, vec)
  return vec
}

// Singleton classifier (lazy-loaded from localStorage on first use).
let classifier: OnlineClassifier | null = null
function getClassifier(): OnlineClassifier {
  if (!classifier) classifier = OnlineClassifier.load()
  return classifier
}

export function classifierStats(): { ready: boolean; samples: number; classes: number } {
  const c = getClassifier()
  return { ready: c.isReady(), samples: c.sampleCount, classes: c.classes.length }
}

/**
 * Record an accept event so the classifier learns over time.
 * Call this when the user accepts a suggestion or manually sorts.
 */
export async function recordFeedback(node: FlowNode, workspaceId: string): Promise<void> {
  try {
    const emb = await embedNode(node)
    if (emb.every((x) => x === 0)) return // empty text — skip
    const c = getClassifier()
    c.trainOne(emb, workspaceId)
    c.save()
  } catch (err) {
    console.warn('recordFeedback failed:', err)
  }
}

/**
 * Bootstrap the classifier from all existing nodes that already live in
 * a workspace. Call once per session (cheap; embeddings are cached).
 */
export async function bootstrapClassifier(allNodes: FlowNode[]): Promise<void> {
  const c = getClassifier()
  if (c.isReady()) return // already trained from feedback

  const placed = allNodes.filter((n) => n.workspace_id && n.type !== 'tab' && n.type !== 'grouple')
  if (placed.length < 10) return // not worth training

  const embMap = await embedNodes(placed)
  const samples: { emb: Float32Array; wsId: string }[] = []
  for (const n of placed) {
    const e = embMap.get(n.id)
    if (e && !e.every((x) => x === 0)) samples.push({ emb: e, wsId: n.workspace_id })
  }
  if (samples.length < 10) return

  c.reset() // start fresh from the bootstrap data
  c.trainBatch(samples, 8, 0.15)
  c.sampleCount = samples.length
  c.save()
}

/**
 * Route a single node: pick best workspace + suggest connections.
 *
 * `nodeEmbedding` may be supplied to avoid recomputing it; otherwise
 * the function embeds the node itself.
 */
export async function routeNode(
  node: FlowNode,
  workspaces: Workspace[],
  allNodes: FlowNode[],
  nodeEmbedding?: Embedding,
): Promise<RouteResult> {
  if (workspaces.length === 0) {
    return {
      workspace_id: '',
      confidence: 0,
      reason: 'no workspaces',
      source: 'heuristic',
      suggested_connections: [],
      suggested_parent_id: null,
    }
  }

  const emb = nodeEmbedding ?? (await embedNode(node))
  const isZero = emb.every((x) => x === 0)

  // Embed all candidate nodes (cached). Keep tabs/groupled parents *in* the
  // pool this time — groupled are how we locate existing project trees, and
  // a dumped node should be able to join an existing project.
  const placedNodes = allNodes.filter(
    (n) => n.workspace_id && n.id !== node.id && n.type !== 'tab',
  )
  const embMap = isZero ? new Map<string, Float32Array>() : await embedNodes(placedNodes)

  // Embed every workspace's name so we can route into sparse / empty
  // workspaces based purely on their label ("Water Bottle Startup" matches a
  // dump about "landing page for the bottle" even if the workspace has no
  // nodes yet).
  const wsNameEmbs = new Map<string, Float32Array>()
  if (!isZero) {
    for (const ws of workspaces) {
      try {
        wsNameEmbs.set(ws.id, await embedWorkspaceName(ws))
      } catch { /* ignore */ }
    }
  }

  // ----- Layer 1: classifier -----
  let classifierPick: { workspace_id: string; prob: number } | null = null
  if (!isZero) {
    const c = getClassifier()
    if (c.isReady()) {
      const probs = c.predict(emb)
      // Only trust the classifier if the workspace still exists.
      const valid = probs.find((p) => workspaces.some((w) => w.id === p.workspace_id))
      if (valid) classifierPick = valid
    }
  }

  // ----- Layer 2: embedding similarity (name + centroid + kNN) -----
  let embeddingPick: { workspace_id: string; score: number; reason: string } | null = null
  if (!isZero) {
    const wsScores = new Map<string, { nameSim: number; centroidSim: number; knnVotes: number; topSim: number }>()
    for (const ws of workspaces) {
      const nameVec = wsNameEmbs.get(ws.id)
      const nameSim = nameVec ? Math.max(0, cosine(emb, nameVec)) : 0
      const wsNodes = placedNodes.filter((n) => n.workspace_id === ws.id)
      const vecs = wsNodes.map((n) => embMap.get(n.id)).filter((v): v is Float32Array => !!v)
      const centroidSim = vecs.length > 0 ? Math.max(0, cosine(emb, meanVector(vecs))) : 0
      wsScores.set(ws.id, { nameSim, centroidSim, knnVotes: 0, topSim: 0 })
    }

    // kNN voting across all placed nodes
    if (placedNodes.length > 0) {
      const sims = placedNodes
        .map((n) => ({ n, sim: cosine(emb, embMap.get(n.id) ?? new Float32Array(emb.length)) }))
        .sort((a, b) => b.sim - a.sim)

      for (const { n, sim } of sims.slice(0, KNN_K)) {
        const entry = wsScores.get(n.workspace_id)
        if (entry) {
          entry.knnVotes += sim
          if (sim > entry.topSim) entry.topSim = sim
        }
      }
    }

    // Combine: workspace-name similarity is the biggest single signal because
    // it works even for empty workspaces. Centroid + kNN refine it.
    let best: { workspace_id: string; score: number; reason: string } | null = null
    for (const [wsId, s] of wsScores) {
      const combined =
        0.5 * s.nameSim +
        0.3 * s.centroidSim +
        0.2 * (s.knnVotes / KNN_K)
      const wsName = workspaces.find((w) => w.id === wsId)?.name ?? wsId
      if (!best || combined > best.score) {
        const parts: string[] = []
        if (s.nameSim > 0.25) parts.push(`name ${Math.round(s.nameSim * 100)}%`)
        if (s.centroidSim > 0.2) parts.push(`content ${Math.round(s.centroidSim * 100)}%`)
        if (s.topSim > 0.3) parts.push(`kNN ${Math.round(s.topSim * 100)}%`)
        const detail = parts.length > 0 ? ` (${parts.join(', ')})` : ''
        best = {
          workspace_id: wsId,
          score: combined,
          reason: `${Math.round(combined * 100)}% → "${wsName}"${detail}`,
        }
      }
    }
    embeddingPick = best
  }

  // ----- Layer 3: heuristic fallback -----
  const heuristicPick = heuristicSort(node, workspaces, allNodes)

  // ----- Decision -----
  let chosen: { workspace_id: string; confidence: number; reason: string; source: RouteResult['source'] }

  if (classifierPick && classifierPick.prob > 0.55) {
    const wsName = workspaces.find((w) => w.id === classifierPick!.workspace_id)?.name ?? ''
    chosen = {
      workspace_id: classifierPick.workspace_id,
      confidence: classifierPick.prob,
      reason: `learned: "${wsName}" (${Math.round(classifierPick.prob * 100)}%)`,
      source: 'classifier',
    }
  } else if (heuristicPick && heuristicPick.confidence > 0.5) {
    // Heuristic only wins outright when it's highly confident (keyword/tag hit).
    chosen = {
      workspace_id: heuristicPick.workspace_id,
      confidence: heuristicPick.confidence,
      reason: heuristicPick.reason,
      source: 'heuristic',
    }
  } else if (embeddingPick) {
    // Always trust the top embedding match if one exists, regardless of
    // absolute score — the user can see the % and reject it. This guarantees
    // every item surfaces a suggestion, even for sparse / unopened workspaces.
    chosen = {
      workspace_id: embeddingPick.workspace_id,
      confidence: Math.max(embeddingPick.score, 0.01),
      reason: embeddingPick.reason,
      source: 'embedding',
    }
  } else if (heuristicPick) {
    chosen = {
      workspace_id: heuristicPick.workspace_id,
      confidence: Math.max(heuristicPick.confidence, 0.01),
      reason: heuristicPick.reason,
      source: 'heuristic',
    }
  } else {
    // Nothing matched — still point at the first workspace so the UI has
    // a target the user can accept or override with one click.
    chosen = {
      workspace_id: workspaces[0].id,
      confidence: 0.01,
      reason: `default → "${workspaces[0].name}"`,
      source: 'heuristic',
    }
  }

  // ----- Connection suggestions -----
  // Only suggest peers inside the workspace we're routing the node into —
  // connections are workspace-scoped and a cross-workspace edge would silently
  // fail when the store tries to create it.
  const suggested_connections: ConnectionSuggestion[] = []
  if (!isZero && placedNodes.length > 0 && chosen.workspace_id) {
    const sims = placedNodes
      .filter((n) => n.type !== 'grouple' && n.workspace_id === chosen.workspace_id)
      .map((n) => ({ n, sim: cosine(emb, embMap.get(n.id) ?? new Float32Array(emb.length)) }))
      .filter(({ sim }) => sim >= CONNECTION_SUGGEST_THRESHOLD)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, MAX_SUGGESTED_CONNECTIONS)

    for (const { n, sim } of sims) {
      suggested_connections.push({
        target_node_id: n.id,
        target_workspace_id: n.workspace_id,
        score: sim,
        reason: sim >= CONNECTION_AUTO_THRESHOLD ? 'strong semantic link' : 'related concept',
      })
    }
  }

  // ----- Grouple parenting -----
  // If the chosen workspace has a project grouple whose contents resemble the
  // dumped node, prefer parenting the node into that existing tree.
  let suggested_parent_id: string | null = null
  if (!isZero && chosen.workspace_id) {
    const groupled = placedNodes.filter(
      (n) => n.type === 'grouple' && n.workspace_id === chosen.workspace_id,
    )
    let bestGrouple: { id: string; score: number } | null = null
    for (const g of groupled) {
      // Score a grouple by the max similarity of its children + its own label.
      const children = placedNodes.filter((n) => n.parent_id === g.id)
      const childVecs = children.map((c) => embMap.get(c.id)).filter((v): v is Float32Array => !!v)
      const gVec = embMap.get(g.id)
      const sims: number[] = []
      if (gVec) sims.push(cosine(emb, gVec))
      for (const v of childVecs) sims.push(cosine(emb, v))
      const top = sims.length > 0 ? Math.max(...sims) : 0
      if (top >= GROUPLE_PARENT_THRESHOLD && (!bestGrouple || top > bestGrouple.score)) {
        bestGrouple = { id: g.id, score: top }
      }
    }
    if (bestGrouple) suggested_parent_id = bestGrouple.id
  }

  return { ...chosen, suggested_connections, suggested_parent_id }
}

export const CONNECTION_THRESHOLDS = {
  AUTO: CONNECTION_AUTO_THRESHOLD,
  SUGGEST: CONNECTION_SUGGEST_THRESHOLD,
}
