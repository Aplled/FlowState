import type { FlowNode, Workspace, NodeType, Json } from '@/types/database'

/** Extract searchable text from a node's data */
function extractText(data: Json): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const d = data as Record<string, Json>
  const parts: string[] = []
  if (typeof d.title === 'string') parts.push(d.title)
  if (typeof d.content === 'string') parts.push(d.content)
  if (typeof d.description === 'string') parts.push(d.description)
  if (typeof d.label === 'string') parts.push(d.label)
  if (typeof d.url === 'string') parts.push(d.url)
  if (typeof d.location === 'string') parts.push(d.location)
  return parts.join(' ').toLowerCase()
}

/** Extract tags from a node */
function extractTags(data: Json): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  const d = data as Record<string, Json>
  if (Array.isArray(d.tags)) return d.tags.filter((t): t is string => typeof t === 'string')
  return []
}

/** Tokenize text into words */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )
}

/** Jaccard similarity between two word sets */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function scoreSuggestion(
  node: FlowNode,
  workspace: Workspace,
  workspaceNodes: FlowNode[],
): { score: number; reason: string } {
  if (workspaceNodes.length === 0) return { score: 0.05, reason: 'Empty workspace' }

  let score = 0
  const reasons: string[] = []

  // 1. Node type affinity
  const typeCount = workspaceNodes.filter((n) => n.type === node.type).length
  const typeRatio = typeCount / workspaceNodes.length
  if (typeRatio > 0.3) {
    const boost = typeRatio * 0.3
    score += boost
    reasons.push(`${Math.round(typeRatio * 100)}% ${node.type} nodes`)
  }

  // 2. Keyword matching (Jaccard similarity)
  const nodeWords = tokenize(extractText(node.data))
  if (nodeWords.size > 0) {
    const wsWords = new Set<string>()
    for (const wn of workspaceNodes) {
      for (const w of tokenize(extractText(wn.data))) wsWords.add(w)
    }
    const sim = jaccard(nodeWords, wsWords)
    if (sim > 0.05) {
      score += sim * 0.4
      reasons.push(`keyword similarity ${Math.round(sim * 100)}%`)
    }
  }

  // 3. Tag matching
  const nodeTags = extractTags(node.data)
  if (nodeTags.length > 0) {
    const wsTags = new Set<string>()
    for (const wn of workspaceNodes) {
      for (const t of extractTags(wn.data)) wsTags.add(t.toLowerCase())
    }
    const matchCount = nodeTags.filter((t) => wsTags.has(t.toLowerCase())).length
    if (matchCount > 0) {
      const tagScore = (matchCount / nodeTags.length) * 0.25
      score += tagScore
      reasons.push(`${matchCount} matching tag${matchCount > 1 ? 's' : ''}`)
    }
  }

  // 4. Recency bias
  const wsAge = Date.now() - new Date(workspace.updated_at).getTime()
  const dayMs = 86400000
  if (wsAge < dayMs) {
    score += 0.1
    reasons.push('recently active')
  } else if (wsAge < 7 * dayMs) {
    score += 0.05
  }

  // 5. Workspace name matching
  const wsNameWords = tokenize(workspace.name)
  if (nodeWords.size > 0 && wsNameWords.size > 0) {
    const nameSim = jaccard(nodeWords, wsNameWords)
    if (nameSim > 0.1) {
      score += nameSim * 0.2
      reasons.push(`matches workspace name`)
    }
  }

  return {
    score: Math.min(score, 1),
    reason: reasons.length > 0 ? reasons.join(', ') : 'Low relevance',
  }
}

export function sortNode(
  node: FlowNode,
  allWorkspaces: Workspace[],
  allNodes: FlowNode[],
): { workspace_id: string; confidence: number; reason: string } | null {
  if (allWorkspaces.length === 0) return null

  let best: { workspace_id: string; confidence: number; reason: string } | null = null

  for (const ws of allWorkspaces) {
    const wsNodes = allNodes.filter((n) => n.workspace_id === ws.id)
    const { score, reason } = scoreSuggestion(node, ws, wsNodes)
    if (!best || score > best.confidence) {
      best = { workspace_id: ws.id, confidence: score, reason }
    }
  }

  return best
}

export interface SortResult {
  itemId: string
  workspace_id: string
  confidence: number
  reason: string
}

export function sortAllItems(
  items: { id: string; node: FlowNode }[],
  workspaces: Workspace[],
  allNodes: FlowNode[],
): SortResult[] {
  return items
    .map((item) => {
      const result = sortNode(item.node, workspaces, allNodes)
      if (!result) return null
      return { itemId: item.id, ...result }
    })
    .filter((r): r is SortResult => r !== null)
}
