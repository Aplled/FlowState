import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { FlowNode, NodeType } from '@/types/database'
import { splitDump, buildSegmentData, detectProjectGroup } from '@/lib/dump-parser'
import type { Json } from '@/types/database'
import { classifyType } from '@/services/type-classifier'
import { inferNodesBatch } from '@/services/groq-classifier'
import {
  routeNode,
  recordFeedback,
  bootstrapClassifier,
  CONNECTION_THRESHOLDS,
  type ConnectionSuggestion,
  type RouteResult,
} from '@/services/asb-router'
import { embedNode, cosine } from '@/services/embeddings'
import { useFolderStore } from '@/stores/folder-store'
import { useNodeStore } from '@/stores/node-store'

const now = () => new Date().toISOString()

const LS_KEY = 'flowstate-asb'

/** Max lines processed per dump. Anything over this gets truncated so the
 *  UI never locks up on huge pastes. */
const MAX_LINES_PER_DUMP = 40
/** How many lines to run through the LLM in a single batch before yielding
 *  to the UI thread. Keeps the page responsive during long sorts. */
const LLM_BATCH_SIZE = 3

const yieldToUI = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

/** After nodes are placed (one or many), wire up semantic edges between
 *  each placed node and its nearest neighbours inside the same workspace.
 *  Candidates include both other placed siblings *and* nodes that were
 *  already in the workspace, so dumping into an existing tree actually
 *  joins that tree instead of leaving an island. */
const EDGE_CONNECT_THRESHOLD = 0.28
const MAX_EDGES_PER_PLACED = 3
async function wireSemanticEdges(placed: FlowNode[]): Promise<void> {
  if (placed.length === 0) return
  const nodeStore = useNodeStore.getState()
  const { allNodes, allConnections } = nodeStore

  const byWs = new Map<string, FlowNode[]>()
  for (const n of placed) {
    if (!n.workspace_id || n.type === 'grouple' || n.type === 'tab') continue
    const arr = byWs.get(n.workspace_id) ?? []
    arr.push(n)
    byWs.set(n.workspace_id, arr)
  }

  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const existing = new Set<string>(
    allConnections.map((c) => edgeKey(c.source_node_id, c.target_node_id)),
  )

  for (const [wsId, placedInWs] of byWs) {
    const candidates = allNodes.filter(
      (n) => n.workspace_id === wsId && n.type !== 'tab' && n.type !== 'grouple',
    )
    if (candidates.length < 2) continue

    const embs = new Map<string, Float32Array>()
    for (const n of candidates) {
      try { embs.set(n.id, await embedNode(n)) } catch { /* ignore */ }
    }

    for (const src of placedInWs) {
      const srcEmb = embs.get(src.id)
      if (!srcEmb) continue
      const scored = candidates
        .filter((c) => c.id !== src.id)
        .map((c) => ({ c, sim: cosine(srcEmb, embs.get(c.id) ?? new Float32Array(srcEmb.length)) }))
        .filter(({ sim }) => sim >= EDGE_CONNECT_THRESHOLD)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, MAX_EDGES_PER_PLACED)

      for (const { c } of scored) {
        const k = edgeKey(src.id, c.id)
        if (existing.has(k)) continue
        existing.add(k)
        try {
          await nodeStore.addConnection(wsId, src.id, c.id)
        } catch (err) {
          console.warn('[ASB] wireSemanticEdges: addConnection failed', err)
        }
      }
    }
  }
}

export interface ASBChildSpec {
  type: NodeType
  data: Json
}

export interface ASBItem {
  id: string
  node: FlowNode
  suggested_workspace_id: string | null
  confidence: number
  reason: string
  source?: RouteResult['source']
  suggested_connections: ConnectionSuggestion[]
  /** Existing grouple (project) node this item should be parented to, if the
   *  router found a strong match. */
  suggested_parent_id?: string | null
  /** When this item is a project group, the child nodes that get created
   *  inside it on accept. Each child becomes a node parented to the grouple. */
  children?: ASBChildSpec[]
  created_at: string
}

export type SortMode = 'suggest' | 'auto' | 'manual'

interface ASBState {
  items: ASBItem[]
  sortMode: SortMode
  isOpen: boolean

  addToASB: (partial: Partial<FlowNode>, opts?: { skipSort?: boolean }) => string
  addDump: (text: string, forcedType?: NodeType) => Promise<number>
  removeFromASB: (id: string) => void
  sortToWorkspace: (itemId: string, workspaceId: string) => Promise<FlowNode | null>
  acceptSuggestion: (itemId: string) => void
  rejectSuggestion: (itemId: string) => void
  setSortMode: (mode: SortMode) => void
  toggleOpen: () => void
  runSorting: () => Promise<void>

  // internal
  _persist: () => void
  _hydrate: () => void
  _autoSortTimeout: ReturnType<typeof setTimeout> | null
}

function loadFromStorage(): { items: ASBItem[]; sortMode: SortMode } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const items = (parsed.items ?? []).map((it: ASBItem) => ({
        ...it,
        suggested_connections: it.suggested_connections ?? [],
      }))
      return { items, sortMode: parsed.sortMode ?? 'auto' }
    }
  } catch { /* ignore */ }
  return { items: [], sortMode: 'auto' }
}

export const useASBStore = create<ASBState>((set, get) => {
  const persisted = loadFromStorage()

  return {
    items: persisted.items,
    sortMode: persisted.sortMode,
    isOpen: false,
    _autoSortTimeout: null,

    _persist: () => {
      const { items, sortMode } = get()
      localStorage.setItem(LS_KEY, JSON.stringify({ items, sortMode }))
    },

    _hydrate: () => {
      const data = loadFromStorage()
      set({ items: data.items, sortMode: data.sortMode })
    },

    addToASB: (partial, opts) => {
      const nodeType: NodeType = partial.type ?? 'note'
      const defaultData: Record<NodeType, () => FlowNode['data']> = {
        task: () => ({ title: 'New Task', status: 'todo', priority: 'none', tags: [] }),
        note: () => ({ content: '' }),
        doc: () => ({ title: 'Untitled', content: '' }),
        table: () => ({ title: 'Untitled Table', columns: [], rows: [] }),
        event: () => ({
          title: 'New Event',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString(),
          all_day: false,
        }),
        browser: () => ({ url: 'https://www.google.com', title: '' }),
        draw: () => ({ strokes: [], background: '#1a1a25' }),
        tab: () => ({ target_workspace_id: '', label: '' }),
        grouple: () => ({ label: '', color: '#6366f1', collapsed: false }),
      }

      const node: FlowNode = {
        id: partial.id ?? nanoid(),
        workspace_id: '',
        type: nodeType,
        position_x: 0,
        position_y: 0,
        width: 220,
        height: 130,
        data: partial.data ?? defaultData[nodeType](),
        parent_id: null,
        is_locked: false,
        is_expanded: false,
        z_index: 0,
        created_at: partial.created_at ?? now(),
        updated_at: now(),
      }

      const item: ASBItem = {
        id: nanoid(),
        node,
        suggested_workspace_id: null,
        confidence: 0,
        reason: '',
        suggested_connections: [],
        created_at: now(),
      }

      set((s) => ({ items: [...s.items, item] }))
      get()._persist()

      // For single adds (not part of a dump batch), kick off a sort+auto-place.
      if (!opts?.skipSort) {
        const mode = get().sortMode
        if (mode !== 'manual') {
          void (async () => {
            await get().runSorting()
            if (mode === 'auto') {
              const fresh = get().items.find((i) => i.id === item.id)
              if (fresh && fresh.suggested_workspace_id) {
                const created = await get().sortToWorkspace(fresh.id, fresh.suggested_workspace_id)
                if (created) await wireSemanticEdges([created])
              }
            }
          })()
        }
      }

      return item.id
    },

    addDump: async (text, forcedType) => {
      // Project group detection: forced via the type selector, or auto-detected
      // when the first line is a project header / title above bullets.
      const wantGroup = forcedType === 'grouple' || (!forcedType && !!detectProjectGroup(text))
      if (wantGroup) {
        const bundle = detectProjectGroup(text) ?? {
          // Forced group with no clear header — use the first line as the label
          // and treat the rest as children.
          label: text.split('\n')[0].trim().slice(0, 80) || 'Project',
          children: splitDump(text.split('\n').slice(1).join('\n')),
        }

        // Cap children so a giant paste doesn't wedge the page.
        const cappedChildren = bundle.children.slice(0, MAX_LINES_PER_DUMP)

        // One batched Groq call for the whole group — ~300ms total regardless
        // of child count. Fall back to the embedding classifier per-child when
        // the API call fails or returns null for a slot.
        const llmResults = await inferNodesBatch(cappedChildren.map((c) => c.text))
        const childSpecs: ASBChildSpec[] = []
        for (let i = 0; i < cappedChildren.length; i++) {
          const c = cappedChildren[i]
          const llm = llmResults[i]
          if (llm) {
            childSpecs.push({ type: llm.type, data: llm.data })
          } else {
            const type = await classifyType(c.text)
            childSpecs.push({ type, data: buildSegmentData(type, c.text, c.tags) })
          }
        }

        const groupId = get().addToASB(
          {
            type: 'grouple',
            data: { label: bundle.label, color: '#6366f1', collapsed: false } as unknown as Json,
          },
          { skipSort: true },
        )
        // Attach children to the inbox item we just created.
        set((s) => ({
          items: s.items.map((it) => (it.id === groupId ? { ...it, children: childSpecs } : it)),
        }))

        await get().runSorting()
        if (get().sortMode === 'auto') {
          const it = get().items.find((i) => i.id === groupId)
          if (it && it.suggested_workspace_id) {
            const createdGroup = await get().sortToWorkspace(groupId, it.suggested_workspace_id)
            if (createdGroup) {
              // The children were just added inside the grouple by
              // sortToWorkspace — pull them out of allNodes and wire edges
              // between them and anything else in this workspace.
              const freshChildren = useNodeStore
                .getState()
                .allNodes.filter((n) => n.parent_id === createdGroup.id)
              await wireSemanticEdges(freshChildren)
            }
          }
        }
        return 1 + childSpecs.length
      }

      const rawAll = splitDump(text)
      if (rawAll.length === 0) return 0
      // Hard cap: never process more than MAX_LINES_PER_DUMP in one go.
      const raw = rawAll.slice(0, MAX_LINES_PER_DUMP)

      // One batched Groq call for the entire dump. Forced override bypasses
      // the LLM entirely. Falls back to the embedding classifier for any slot
      // the API couldn't resolve.
      const segments: Array<{ text: string; tags: string[]; type: NodeType; data: Json }> = []
      const llmResults = forcedType
        ? raw.map(() => null)
        : await inferNodesBatch(raw.map((s) => s.text))
      for (let i = 0; i < raw.length; i++) {
        const seg = raw[i]
        const llm = llmResults[i]
        if (forcedType) {
          segments.push({ ...seg, type: forcedType, data: buildSegmentData(forcedType, seg.text, seg.tags) })
        } else if (llm) {
          segments.push({ ...seg, type: llm.type, data: llm.data })
        } else {
          const type = await classifyType(seg.text)
          segments.push({ ...seg, type, data: buildSegmentData(type, seg.text, seg.tags) })
        }
      }

      const itemIds: string[] = []
      for (const seg of segments) {
        itemIds.push(get().addToASB({ type: seg.type, data: seg.data }, { skipSort: true }))
      }

      // Run a routing pass; only auto-place when sortMode === 'auto'.
      // In 'suggest' (and 'manual') mode the user must confirm each item.
      await get().runSorting()
      if (get().sortMode === 'auto') {
        const placed: FlowNode[] = []
        for (const id of itemIds) {
          const it = get().items.find((i) => i.id === id)
          if (it && it.suggested_workspace_id) {
            const created = await get().sortToWorkspace(id, it.suggested_workspace_id)
            if (created) placed.push(created)
          }
        }
        // Post-placement edge pass. routeNode can't see sibling items during
        // routing (they aren't in allNodes yet) and the cached
        // suggested_connections only cover the pre-dump tree, so explicitly
        // wire each placed node to its nearest neighbours — siblings *and*
        // existing tree members — now that everything is in the graph.
        await wireSemanticEdges(placed)
      }
      return segments.length
    },

    removeFromASB: (id) => {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
      get()._persist()
    },

    sortToWorkspace: async (itemId, workspaceId) => {
      const item = get().items.find((i) => i.id === itemId)
      if (!item) {
        console.warn('[ASB] sortToWorkspace: item not found', itemId)
        return null
      }

      const nodeStore = useNodeStore.getState()
      const x = 100 + Math.random() * 400
      const y = 100 + Math.random() * 400

      let created
      try {
        created = await nodeStore.addNode(workspaceId, item.node.type, { x, y }, item.node.data)
      } catch (err) {
        console.error('[ASB] addNode failed for parent:', err, { workspaceId, type: item.node.type })
        return null
      }
      if (!created) {
        console.warn('[ASB] addNode returned null for parent', { workspaceId, type: item.node.type })
        return null
      }

      // If the router found an existing project grouple in this workspace
      // that the item belongs in, parent it there so it joins the tree.
      if (item.suggested_parent_id) {
        const parent = useNodeStore.getState().allNodes.find((n) => n.id === item.suggested_parent_id)
        if (parent && parent.workspace_id === workspaceId && parent.type === 'grouple') {
          try {
            nodeStore.setParent(created.id, parent.id)
          } catch (err) {
            console.warn('[ASB] setParent to suggested grouple failed:', err)
          }
        }
      }

      // If this item is a project group, lay out its children inside it.
      if (item.children && item.children.length > 0) {
        const cols = Math.ceil(Math.sqrt(item.children.length))
        const spacingX = 240
        const spacingY = 160
        for (let i = 0; i < item.children.length; i++) {
          const child = item.children[i]
          const col = i % cols
          const row = Math.floor(i / cols)
          const childPos = {
            x: x + 40 + col * spacingX,
            y: y + 80 + row * spacingY,
          }
          try {
            const childNode = await nodeStore.addNode(workspaceId, child.type, childPos, child.data)
            if (childNode) nodeStore.setParent(childNode.id, created.id)
          } catch (err) {
            console.error('[ASB] child addNode failed:', err, { type: child.type, data: child.data })
          }
        }
      }

      // Wire up every suggested connection that cleared the SUGGEST
      // threshold. Previously we only fired the strongest (>= AUTO) edges,
      // which meant most dumps landed with zero arrows even when the router
      // had clearly identified related peers.
      const sourceId = created?.id
      if (sourceId) {
        for (const sug of item.suggested_connections) {
          if (sug.score >= CONNECTION_THRESHOLDS.SUGGEST) {
            try {
              await nodeStore.addConnection(workspaceId, sourceId, sug.target_node_id)
            } catch (err) {
              console.warn('auto-connection failed:', err)
            }
          }
        }
      }

      // Train the classifier on this routing decision.
      void recordFeedback({ ...item.node, workspace_id: workspaceId }, workspaceId)

      set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }))
      get()._persist()
      return created
    },

    acceptSuggestion: (itemId) => {
      const item = get().items.find((i) => i.id === itemId)
      if (!item || !item.suggested_workspace_id) return
      get().sortToWorkspace(itemId, item.suggested_workspace_id)
    },

    rejectSuggestion: (itemId) => {
      set((s) => ({
        items: s.items.map((i) =>
          i.id === itemId ? { ...i, suggested_workspace_id: null, confidence: 0, reason: 'Suggestion rejected' } : i
        ),
      }))
      get()._persist()
    },

    setSortMode: (mode) => {
      set({ sortMode: mode })
      get()._persist()
    },

    toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

    runSorting: async () => {
      const { items } = get()
      // Make sure we see EVERY workspace, not just those whose folders are
      // currently expanded in the sidebar. Without this, routing would only
      // consider the subset of workspaces the user has actively opened.
      try { await useFolderStore.getState().fetchAllWorkspaces() } catch { /* ignore */ }
      // Route into every workspace, including embedded (child) ones — a dump
      // about "the water bottle landing page" should land inside the nested
      // marketing workspace, not just its parent.
      const workspaces = useFolderStore.getState().workspaces
      const { allNodes } = useNodeStore.getState()
      if (workspaces.length === 0 || items.length === 0) return

      // Bootstrap the classifier from existing nodes once per session.
      void bootstrapClassifier(allNodes)

      // Route each item via the embedding+classifier+heuristic pipeline.
      const updates = new Map<string, RouteResult>()
      for (const item of items) {
        try {
          updates.set(item.id, await routeNode(item.node, workspaces, allNodes))
        } catch (err) {
          console.warn('routeNode failed for', item.id, err)
        }
      }

      set((s) => ({
        items: s.items.map((item) => {
          const r = updates.get(item.id)
          if (!r) return item
          return {
            ...item,
            suggested_workspace_id: r.workspace_id,
            confidence: r.confidence,
            reason: r.reason,
            source: r.source,
            suggested_connections: r.suggested_connections,
            suggested_parent_id: r.suggested_parent_id,
          }
        }),
      }))
      get()._persist()
    },
  }
})
