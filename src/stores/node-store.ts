import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { FlowNode, Connection, NodeType, Json } from '@/types/database'
import type { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

// Convert DB node to React Flow node
function toReactFlowNode(n: FlowNode): Node {
  return {
    id: n.id,
    type: n.type,
    position: { x: n.position_x, y: n.position_y },
    data: {
      ...(n.data as Record<string, unknown>),
      _dbNode: n,
    },
    style: { width: n.width, height: n.height },
    zIndex: n.z_index,
    parentId: n.parent_id ?? undefined,
    draggable: !n.is_locked,
  }
}

// Convert DB connection to React Flow edge
function toReactFlowEdge(c: Connection): Edge {
  return {
    id: c.id,
    source: c.source_node_id,
    target: c.target_node_id,
    label: c.label ?? undefined,
    type: c.is_directed ? 'default' : 'straight',
    style: {
      strokeDasharray: c.style === 'dashed' ? '5,5' : c.style === 'dotted' ? '2,2' : undefined,
    },
    data: { _dbEdge: c },
  }
}

interface NodeState {
  nodes: Node[]
  edges: Edge[]
  dbNodes: FlowNode[]
  dbConnections: Connection[]

  // React Flow change handlers (set from external applyChanges)
  setApplyFns: (
    applyNodes: typeof applyNodeChanges,
    applyEdges: typeof applyEdgeChanges
  ) => void
  _applyNodeChanges: typeof applyNodeChanges | null
  _applyEdgeChanges: typeof applyEdgeChanges | null

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange

  fetchNodes: (workspaceId: string) => Promise<void>
  fetchConnections: (workspaceId: string) => Promise<void>

  addNode: (workspaceId: string, type: NodeType, position: { x: number; y: number }, data?: Json) => Promise<FlowNode>
  updateNode: (id: string, updates: Partial<FlowNode>) => Promise<void>
  deleteNode: (id: string) => Promise<void>

  addConnection: (workspaceId: string, sourceId: string, targetId: string) => Promise<Connection>
  deleteConnection: (id: string) => Promise<void>

  clearCanvas: () => void
}

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
  draw: () => ({ strokes: [], background: '#ffffff' }),
  tab: () => ({ target_workspace_id: '', label: '' }),
  grouple: () => ({ label: '', color: '#6366f1', child_ids: [] }),
}

const defaultNodeSizes: Record<NodeType, { width: number; height: number }> = {
  task: { width: 280, height: 160 },
  note: { width: 240, height: 160 },
  doc: { width: 400, height: 300 },
  table: { width: 500, height: 350 },
  event: { width: 280, height: 140 },
  browser: { width: 600, height: 400 },
  draw: { width: 500, height: 400 },
  tab: { width: 200, height: 80 },
  grouple: { width: 400, height: 300 },
}

export const useNodeStore = create<NodeState>((set, get) => ({
  nodes: [],
  edges: [],
  dbNodes: [],
  dbConnections: [],
  _applyNodeChanges: null,
  _applyEdgeChanges: null,

  setApplyFns: (applyNodes, applyEdges) => {
    set({ _applyNodeChanges: applyNodes, _applyEdgeChanges: applyEdges })
  },

  onNodesChange: (changes) => {
    const applyFn = get()._applyNodeChanges
    if (applyFn) {
      set({ nodes: applyFn(changes, get().nodes) })
    }
  },

  onEdgesChange: (changes) => {
    const applyFn = get()._applyEdgeChanges
    if (applyFn) {
      set({ edges: applyFn(changes, get().edges) })
    }
  },

  fetchNodes: async (workspaceId) => {
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('z_index')

    if (data) {
      const dbNodes = data as FlowNode[]
      set({
        dbNodes,
        nodes: dbNodes.map(toReactFlowNode),
      })
    }
  },

  fetchConnections: async (workspaceId) => {
    const { data } = await supabase
      .from('connections')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (data) {
      const dbConnections = data as Connection[]
      set({
        dbConnections,
        edges: dbConnections.map(toReactFlowEdge),
      })
    }
  },

  addNode: async (workspaceId, type, position, data) => {
    const size = defaultNodeSizes[type]
    const nodeData = data ?? defaultNodeData[type]()

    const { data: created, error } = await supabase
      .from('nodes')
      .insert({
        workspace_id: workspaceId,
        type,
        position_x: position.x,
        position_y: position.y,
        width: size.width,
        height: size.height,
        data: nodeData,
      })
      .select()
      .single()

    if (error) throw error

    const dbNode = created as FlowNode
    set((s) => ({
      dbNodes: [...s.dbNodes, dbNode],
      nodes: [...s.nodes, toReactFlowNode(dbNode)],
    }))
    return dbNode
  },

  updateNode: async (id, updates) => {
    const { error } = await supabase.from('nodes').update(updates).eq('id', id)
    if (error) throw error

    set((s) => {
      const dbNodes = s.dbNodes.map((n) => (n.id === id ? { ...n, ...updates } : n))
      return {
        dbNodes,
        nodes: dbNodes.map(toReactFlowNode),
      }
    })
  },

  deleteNode: async (id) => {
    const { error } = await supabase.from('nodes').delete().eq('id', id)
    if (error) throw error

    set((s) => ({
      dbNodes: s.dbNodes.filter((n) => n.id !== id),
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }))
  },

  addConnection: async (workspaceId, sourceId, targetId) => {
    const { data, error } = await supabase
      .from('connections')
      .insert({
        workspace_id: workspaceId,
        source_node_id: sourceId,
        target_node_id: targetId,
      })
      .select()
      .single()

    if (error) throw error

    const conn = data as Connection
    set((s) => ({
      dbConnections: [...s.dbConnections, conn],
      edges: [...s.edges, toReactFlowEdge(conn)],
    }))
    return conn
  },

  deleteConnection: async (id) => {
    const { error } = await supabase.from('connections').delete().eq('id', id)
    if (error) throw error

    set((s) => ({
      dbConnections: s.dbConnections.filter((c) => c.id !== id),
      edges: s.edges.filter((e) => e.id !== id),
    }))
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], dbNodes: [], dbConnections: [] })
  },
}))
