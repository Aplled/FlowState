import { create } from 'zustand'
import { isSupabaseConfigured } from '@/lib/supabase'
import * as db from '@/lib/db'
import type { FlowNode, Connection, ConnectionDirection, NodeType, Json } from '@/types/database'
import { nanoid } from 'nanoid'

const now = () => new Date().toISOString()

const defaultNodeData: Record<NodeType, () => Json> = {
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
  grouple: () => ({ label: '', color: '#6366f1', child_ids: [] }),
}

const defaultNodeSizes: Record<NodeType, { width: number; height: number }> = {
  task: { width: 220, height: 130 },
  note: { width: 200, height: 150 },
  doc: { width: 320, height: 240 },
  table: { width: 400, height: 280 },
  event: { width: 220, height: 120 },
  browser: { width: 480, height: 320 },
  draw: { width: 400, height: 320 },
  tab: { width: 180, height: 70 },
  grouple: { width: 320, height: 240 },
}

interface NodeState {
  nodes: FlowNode[]
  connections: Connection[]
  selectedNodeIds: string[]
  activeWsId: string | null

  // All data across workspaces (demo/offline mode)
  allNodes: FlowNode[]
  allConnections: Connection[]

  setSelectedNodes: (ids: string[]) => void
  clearSelection: () => void

  fetchNodes: (workspaceId: string) => Promise<void>
  fetchConnections: (workspaceId: string) => Promise<void>

  addNode: (workspaceId: string, type: NodeType, position: { x: number; y: number }, data?: Json) => Promise<FlowNode>
  updateNode: (id: string, updates: Partial<FlowNode>) => void
  moveNode: (id: string, x: number, y: number) => void
  persistNodePosition: (id: string, x: number, y: number) => void
  deleteNode: (id: string) => void

  updateConnection: (id: string, updates: Partial<Connection>) => void
  addConnection: (workspaceId: string, sourceId: string, targetId: string) => Promise<Connection>
  deleteConnection: (id: string) => void

  clearCanvas: () => void
}

function deriveForWorkspace(wsId: string, allNodes: FlowNode[], allConns: Connection[]) {
  return {
    activeWsId: wsId,
    nodes: allNodes.filter((n) => n.workspace_id === wsId),
    connections: allConns.filter((c) => c.workspace_id === wsId),
  }
}

export const useNodeStore = create<NodeState>((set, get) => ({
  nodes: [],
  connections: [],
  selectedNodeIds: [],
  activeWsId: null,
  allNodes: [],
  allConnections: [],

  setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
  clearSelection: () => set({ selectedNodeIds: [] }),

  fetchNodes: async (workspaceId) => {
    if (!isSupabaseConfigured) {
      set(deriveForWorkspace(workspaceId, get().allNodes, get().allConnections))
      return
    }
    try {
      const data = await db.fetchNodes(workspaceId)
      set({ activeWsId: workspaceId, nodes: data })
    } catch (err) {
      console.error('Failed to fetch nodes:', err)
      set(deriveForWorkspace(workspaceId, get().allNodes, get().allConnections))
    }
  },

  fetchConnections: async (workspaceId) => {
    if (!isSupabaseConfigured) {
      set(deriveForWorkspace(workspaceId, get().allNodes, get().allConnections))
      return
    }
    try {
      const data = await db.fetchConnections(workspaceId)
      set({ connections: data })
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    }
  },

  addNode: async (workspaceId, type, position, data) => {
    const size = defaultNodeSizes[type]
    const nodeData = data ?? defaultNodeData[type]()
    const node: FlowNode = {
      id: nanoid(),
      workspace_id: workspaceId,
      type,
      position_x: position.x,
      position_y: position.y,
      width: size.width,
      height: size.height,
      data: nodeData,
      parent_id: null,
      is_locked: false,
      is_expanded: false,
      z_index: get().nodes.length,
      created_at: now(),
      updated_at: now(),
    }

    // Optimistic update
    set((s) => ({ nodes: [...s.nodes, node], allNodes: [...s.allNodes, node] }))

    if (isSupabaseConfigured) {
      try {
        const created = await db.createNode(node)
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === node.id ? created : n)),
          allNodes: s.allNodes.map((n) => (n.id === node.id ? created : n)),
        }))
        return created
      } catch (err) {
        // Rollback
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== node.id),
          allNodes: s.allNodes.filter((n) => n.id !== node.id),
        }))
        throw err
      }
    }

    return node
  },

  updateNode: (id, updates) => {
    // Optimistic update
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates, updated_at: now() } : n)),
      allNodes: s.allNodes.map((n) => (n.id === id ? { ...n, ...updates, updated_at: now() } : n)),
    }))
    if (isSupabaseConfigured) {
      db.updateNode(id, updates).catch((err) => console.error('Failed to update node:', err))
    }
  },

  moveNode: (id, x, y) => {
    // Optimistic local move -- no DB call, just update position for rendering
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, position_x: x, position_y: y } : n)),
    }))
  },

  persistNodePosition: (id, x, y) => {
    const updates = { position_x: x, position_y: y, updated_at: now() }
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      allNodes: s.allNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }))
    if (isSupabaseConfigured) {
      db.updateNode(id, updates).catch((err) => console.error('Failed to persist node position:', err))
    }
  },

  deleteNode: (id) => {
    // Optimistic
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      allNodes: s.allNodes.filter((n) => n.id !== id),
      connections: s.connections.filter((c) => c.source_node_id !== id && c.target_node_id !== id),
      allConnections: s.allConnections.filter((c) => c.source_node_id !== id && c.target_node_id !== id),
      selectedNodeIds: s.selectedNodeIds.filter((sid) => sid !== id),
    }))
    if (isSupabaseConfigured) {
      db.deleteNode(id).catch((err) => console.error('Failed to delete node:', err))
    }
  },

  updateConnection: (id, updates) => {
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      allConnections: s.allConnections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
    if (isSupabaseConfigured) {
      db.updateConnection(id, updates).catch((err) => console.error('Failed to update connection:', err))
    }
  },

  addConnection: async (workspaceId, sourceId, targetId) => {
    const conn: Connection = {
      id: nanoid(),
      workspace_id: workspaceId,
      source_node_id: sourceId,
      target_node_id: targetId,
      label: null,
      style: 'solid',
      direction: 'directed',
      weight: null,
      created_at: now(),
    }

    // Optimistic
    set((s) => ({ connections: [...s.connections, conn], allConnections: [...s.allConnections, conn] }))

    if (isSupabaseConfigured) {
      try {
        const created = await db.createConnection(conn)
        set((s) => ({
          connections: s.connections.map((c) => (c.id === conn.id ? created : c)),
          allConnections: s.allConnections.map((c) => (c.id === conn.id ? created : c)),
        }))
        return created
      } catch (err) {
        set((s) => ({
          connections: s.connections.filter((c) => c.id !== conn.id),
          allConnections: s.allConnections.filter((c) => c.id !== conn.id),
        }))
        throw err
      }
    }

    return conn
  },

  deleteConnection: (id) => {
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      allConnections: s.allConnections.filter((c) => c.id !== id),
    }))
    if (isSupabaseConfigured) {
      db.deleteConnection(id).catch((err) => console.error('Failed to delete connection:', err))
    }
  },

  clearCanvas: () => set({ nodes: [], connections: [], selectedNodeIds: [] }),
}))
