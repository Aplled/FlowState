import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { FlowNode, NodeType } from '@/types/database'
import { sortAllItems } from '@/lib/asb-sorter'
import { parseDump } from '@/lib/dump-parser'
import { useFolderStore } from '@/stores/folder-store'
import { useNodeStore } from '@/stores/node-store'

const now = () => new Date().toISOString()

const LS_KEY = 'flowstate-asb'

export interface ASBItem {
  id: string
  node: FlowNode
  suggested_workspace_id: string | null
  confidence: number
  reason: string
  created_at: string
}

export type SortMode = 'suggest' | 'auto' | 'manual'

interface ASBState {
  items: ASBItem[]
  sortMode: SortMode
  isOpen: boolean

  addToASB: (partial: Partial<FlowNode>) => void
  addDump: (text: string) => number
  removeFromASB: (id: string) => void
  sortToWorkspace: (itemId: string, workspaceId: string) => void
  acceptSuggestion: (itemId: string) => void
  rejectSuggestion: (itemId: string) => void
  setSortMode: (mode: SortMode) => void
  toggleOpen: () => void
  runSorting: () => void

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
      return { items: parsed.items ?? [], sortMode: parsed.sortMode ?? 'suggest' }
    }
  } catch { /* ignore */ }
  return { items: [], sortMode: 'suggest' }
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

    addToASB: (partial) => {
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
        created_at: now(),
      }

      set((s) => ({ items: [...s.items, item] }))
      get()._persist()

      // Run sorting
      const mode = get().sortMode
      if (mode === 'suggest' || mode === 'auto') {
        // Small delay so the item appears first
        const timeout = setTimeout(() => {
          get().runSorting()
          // Auto-sort: place high-confidence items immediately
          if (mode === 'auto') {
            const state = get()
            const freshItem = state.items.find((i) => i.id === item.id)
            if (freshItem && freshItem.confidence > 0.7 && freshItem.suggested_workspace_id) {
              get().sortToWorkspace(freshItem.id, freshItem.suggested_workspace_id)
            }
          }
        }, mode === 'auto' ? 2000 : 500)

        const prev = get()._autoSortTimeout
        if (prev) clearTimeout(prev)
        set({ _autoSortTimeout: timeout })
      }
    },

    addDump: (text) => {
      const segments = parseDump(text)
      for (const seg of segments) {
        get().addToASB({ type: seg.type, data: seg.data })
      }
      // Force a sorting pass after the batch is added
      if (segments.length > 0) {
        setTimeout(() => get().runSorting(), 100)
      }
      return segments.length
    },

    removeFromASB: (id) => {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
      get()._persist()
    },

    sortToWorkspace: (itemId, workspaceId) => {
      const item = get().items.find((i) => i.id === itemId)
      if (!item) return

      // Add the node to the workspace via node store
      const { addNode } = useNodeStore.getState()
      // Place at a random-ish position so nodes don't stack
      const x = 100 + Math.random() * 400
      const y = 100 + Math.random() * 400
      addNode(workspaceId, item.node.type, { x, y }, item.node.data)

      // Remove from ASB
      set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }))
      get()._persist()
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

    runSorting: () => {
      const { items } = get()
      const { workspaces } = useFolderStore.getState()
      const { allNodes } = useNodeStore.getState()

      if (workspaces.length === 0) return

      const results = sortAllItems(items, workspaces, allNodes)
      const resultMap = new Map(results.map((r) => [r.itemId, r]))

      set((s) => ({
        items: s.items.map((item) => {
          const result = resultMap.get(item.id)
          if (!result) return item
          return {
            ...item,
            suggested_workspace_id: result.workspace_id,
            confidence: result.confidence,
            reason: result.reason,
          }
        }),
      }))
      get()._persist()
    },
  }
})
