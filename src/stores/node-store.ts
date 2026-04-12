import { create } from 'zustand'
import { isSupabaseConfigured } from '@/lib/supabase'
import * as db from '@/lib/db'
import type { FlowNode, Connection, ConnectionDirection, NodeType, Json } from '@/types/database'
import { nanoid } from 'nanoid'
import { scheduleEventNodeSync, deleteLinkedGoogleEvent } from '@/services/event-auto-sync'

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
  tab: () => ({ target_workspace_id: '', label: '', color: '#64748b' }),
  grouple: () => ({ label: '', color: '#6366f1', collapsed: false }),
}

const defaultNodeSizes: Record<NodeType, { width: number; height: number }> = {
  task: { width: 220, height: 130 },
  note: { width: 200, height: 150 },
  doc: { width: 320, height: 240 },
  table: { width: 400, height: 280 },
  event: { width: 260, height: 160 },
  browser: { width: 280, height: 160 },
  draw: { width: 560, height: 480 },
  tab: { width: 200, height: 120 },
  grouple: { width: 220, height: 50 },
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
  fetchAllData: () => Promise<void>

  addNode: (workspaceId: string, type: NodeType, position: { x: number; y: number }, data?: Json) => Promise<FlowNode>
  updateNode: (id: string, updates: Partial<FlowNode>) => void
  moveNode: (id: string, x: number, y: number) => void
  persistNodePosition: (id: string, x: number, y: number) => void
  deleteNode: (id: string, options?: { skipRemoteSync?: boolean }) => void

  updateConnection: (id: string, updates: Partial<Connection>) => void
  addConnection: (workspaceId: string, sourceId: string, targetId: string) => Promise<Connection>
  deleteConnection: (id: string) => void

  setParent: (childId: string, parentId: string | null) => void
  addToGroup: (childId: string, groupId: string) => void
  removeFromGroup: (childId: string, groupId: string) => void
  getChildNodes: (parentId: string) => FlowNode[]
  getCollapsedNodeIds: () => Set<string>

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

  fetchAllData: async () => {
    if (!isSupabaseConfigured) return
    try {
      const [nodes, connections] = await Promise.all([
        db.fetchAllNodes(),
        db.fetchAllConnections(),
      ])
      set({ allNodes: nodes, allConnections: connections })

      // Orphan cleanup: any embedded (child) workspace with no tab node
      // pointing at it is a leftover from a deleted tab — kill it.
      void (async () => {
        const { useFolderStore } = await import('@/stores/folder-store')
        const fs = useFolderStore.getState()
        const referenced = new Set(
          nodes
            .filter((n) => n.type === 'tab')
            .map((n) => (n.data as { target_workspace_id?: string })?.target_workspace_id)
            .filter((x): x is string => !!x),
        )
        const orphans = fs.workspaces.filter(
          (w) => w.parent_workspace_id && !referenced.has(w.id),
        )
        for (const o of orphans) {
          console.log('cleaning orphan embedded workspace:', o.name, o.id)
          await fs.deleteWorkspace(o.id)
        }
      })()
    } catch (err) {
      console.error('Failed to fetch all data:', err)
    }
  },

  fetchNodes: async (workspaceId) => {
    if (!isSupabaseConfigured) {
      set(deriveForWorkspace(workspaceId, get().allNodes, get().allConnections))
      return
    }
    try {
      const data = await db.fetchNodes(workspaceId)
      set((s) => {
        // Merge fetched nodes into allNodes (replace existing for this workspace)
        const otherNodes = s.allNodes.filter((n) => n.workspace_id !== workspaceId)
        return { activeWsId: workspaceId, nodes: data, allNodes: [...otherNodes, ...data] }
      })
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
      set((s) => {
        const otherConns = s.allConnections.filter((c) => c.workspace_id !== workspaceId)
        return { connections: data, allConnections: [...otherConns, ...data] }
      })
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

    if (type === 'event') scheduleEventNodeSync(node.id)

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
    // If this update touches an event node's data, schedule a Google Calendar sync.
    if ('data' in updates) {
      const node = get().allNodes.find((n) => n.id === id)
      if (node?.type === 'event') scheduleEventNodeSync(id)
    }
    if (isSupabaseConfigured) {
      db.updateNode(id, updates).catch((err) => console.error('Failed to update node:', err))
    }
  },

  moveNode: (id, x, y) => {
    set((s) => {
      const node = s.nodes.find((n) => n.id === id)
      if (!node) return s
      const dx = x - node.position_x
      const dy = y - node.position_y
      // Collect all descendant ids for group nodes
      const descendantIds = new Set<string>()
      if (node.type === 'grouple') {
        const collect = (pid: string) => {
          for (const n of s.nodes) {
            if (n.parent_id === pid && !descendantIds.has(n.id)) {
              descendantIds.add(n.id)
              collect(n.id)
            }
          }
        }
        collect(id)
      }
      return {
        nodes: s.nodes.map((n) => {
          if (n.id === id) return { ...n, position_x: x, position_y: y }
          if (descendantIds.has(n.id)) return { ...n, position_x: n.position_x + dx, position_y: n.position_y + dy }
          return n
        }),
      }
    })
  },

  persistNodePosition: (id, x, y) => {
    const s = get()
    const node = s.nodes.find((n) => n.id === id)
    if (!node) return
    const dx = x - node.position_x
    const dy = y - node.position_y

    // Collect descendants for group nodes
    const descendantIds = new Set<string>()
    if (node.type === 'grouple') {
      const collect = (pid: string) => {
        for (const n of s.nodes) {
          if (n.parent_id === pid && !descendantIds.has(n.id)) {
            descendantIds.add(n.id)
            collect(n.id)
          }
        }
      }
      collect(id)
    }

    const ts = now()
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id === id) return { ...n, position_x: x, position_y: y, updated_at: ts }
        if (descendantIds.has(n.id)) return { ...n, position_x: n.position_x + dx, position_y: n.position_y + dy, updated_at: ts }
        return n
      }),
      allNodes: s.allNodes.map((n) => {
        if (n.id === id) return { ...n, position_x: x, position_y: y, updated_at: ts }
        if (descendantIds.has(n.id)) return { ...n, position_x: n.position_x + dx, position_y: n.position_y + dy, updated_at: ts }
        return n
      }),
    }))

    if (isSupabaseConfigured) {
      db.updateNode(id, { position_x: x, position_y: y }).catch((err) => console.error('Failed to persist node position:', err))
      for (const did of descendantIds) {
        const dn = get().nodes.find((n) => n.id === did)
        if (dn) db.updateNode(did, { position_x: dn.position_x, position_y: dn.position_y }).catch((err) => console.error('Failed to persist child position:', err))
      }
    }
  },

  deleteNode: (id, options) => {
    const existing = get().allNodes.find((n) => n.id === id)

    // Mirror delete to Google Calendar if linked (unless caller is the sync engine)
    if (!options?.skipRemoteSync && existing?.type === 'event') {
      void deleteLinkedGoogleEvent(existing)
    }

    // If we're deleting a tab node, also tear down its embedded workspace
    // so we don't leave orphans floating around. We do this asynchronously
    // via a dynamic import to avoid a circular dep with folder-store.
    if (existing?.type === 'tab') {
      const targetId = (existing.data as { target_workspace_id?: string })?.target_workspace_id
      if (targetId) {
        void import('@/stores/folder-store').then(({ useFolderStore }) => {
          const ws = useFolderStore.getState().workspaces.find((w) => w.id === targetId)
          // Only auto-delete embedded (child) workspaces, never top-level ones.
          if (ws && ws.parent_workspace_id) {
            void useFolderStore.getState().deleteWorkspace(targetId)
          }
        })
      }
    }

    // Unparent children before deleting
    set((s) => ({
      nodes: s.nodes.map((n) => n.parent_id === id ? { ...n, parent_id: null } : n).filter((n) => n.id !== id),
      allNodes: s.allNodes.map((n) => n.parent_id === id ? { ...n, parent_id: null } : n).filter((n) => n.id !== id),
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
    const { nodes, allNodes, setParent } = get()
    // Look up in allNodes so connections can be created from any workspace
    // context (e.g. the ASB panel while another canvas is active).
    const source = allNodes.find((n) => n.id === sourceId)
    const target = allNodes.find((n) => n.id === targetId)
    if (!source || !target) throw new Error('Node not found')

    // Connecting TO a group node → add source as child of that group
    if (target.type === 'grouple') {
      setParent(sourceId, targetId)
      // Return a dummy connection to satisfy the type — no actual edge created
      return { id: '', workspace_id: workspaceId, source_node_id: sourceId, target_node_id: targetId, label: null, style: 'solid' as const, direction: 'directed' as const, weight: null, created_at: now() }
    }
    // Connecting FROM a group node → add target as child of that group
    if (source.type === 'grouple') {
      setParent(targetId, sourceId)
      return { id: '', workspace_id: workspaceId, source_node_id: sourceId, target_node_id: targetId, label: null, style: 'solid' as const, direction: 'directed' as const, weight: null, created_at: now() }
    }

    // Find the group ancestor of a node
    const findGroupAncestor = (nodeId: string): string | null => {
      let cur = nodes.find((n) => n.id === nodeId)
      while (cur?.parent_id) {
        const parent = nodes.find((n) => n.id === cur!.parent_id)
        if (parent?.type === 'grouple') return parent.id
        cur = parent
      }
      return null
    }

    // Walk the connection graph from a starting node and return all reachable node ids
    // that are not already in any group
    const { connections: existingConns } = get()
    const collectConnectedChain = (startId: string): string[] => {
      const visited = new Set<string>()
      const queue = [startId]
      while (queue.length > 0) {
        const id = queue.pop()!
        if (visited.has(id)) continue
        visited.add(id)
        for (const c of existingConns) {
          if (c.source_node_id === id && !visited.has(c.target_node_id)) queue.push(c.target_node_id)
          if (c.target_node_id === id && !visited.has(c.source_node_id)) queue.push(c.source_node_id)
        }
      }
      return [...visited]
    }

    const sourceGroup = findGroupAncestor(sourceId)
    const targetGroup = findGroupAncestor(targetId)

    // If source is in a group and target isn't, pull target + its entire connected chain into source's group
    if (sourceGroup && !targetGroup) {
      const chain = collectConnectedChain(targetId)
      for (const nid of chain) {
        if (!findGroupAncestor(nid) && nodes.find((n) => n.id === nid)?.type !== 'grouple') {
          setParent(nid, sourceGroup)
        }
      }
    }
    // If target is in a group and source isn't, pull source + its entire connected chain into target's group
    else if (targetGroup && !sourceGroup) {
      const chain = collectConnectedChain(sourceId)
      for (const nid of chain) {
        if (!findGroupAncestor(nid) && nodes.find((n) => n.id === nid)?.type !== 'grouple') {
          setParent(nid, targetGroup)
        }
      }
    }

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

  setParent: (childId, parentId) => {
    const s = get()
    const child = s.nodes.find((n) => n.id === childId)
    if (!child || child.parent_id === parentId) return
    if (parentId === childId) return
    // Don't allow setting parent to a descendant (cycle check)
    if (parentId) {
      const descendants = new Set<string>()
      const collect = (pid: string) => {
        for (const n of s.nodes) {
          if (n.parent_id === pid && !descendants.has(n.id)) {
            descendants.add(n.id)
            collect(n.id)
          }
        }
      }
      collect(childId)
      if (descendants.has(parentId)) return
    }

    // Collect childId + all its descendants to reparent together
    const toReparent = [childId]
    const collectChildren = (pid: string) => {
      for (const n of s.nodes) {
        if (n.parent_id === pid) {
          toReparent.push(n.id)
          collectChildren(n.id)
        }
      }
    }
    // Only reparent descendants when moving into a group (not when unparenting)
    if (parentId) collectChildren(childId)

    const ts = now()
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id === childId) return { ...n, parent_id: parentId, updated_at: ts }
        // Move direct descendants of childId to be under parentId too,
        // but only the top-level node changes parent — descendants keep their existing parent chain
        return n
      }),
      allNodes: s.allNodes.map((n) => {
        if (n.id === childId) return { ...n, parent_id: parentId, updated_at: ts }
        return n
      }),
    }))
    if (isSupabaseConfigured) {
      db.updateNode(childId, { parent_id: parentId }).catch((err) => console.error('Failed to set parent:', err))
    }
  },

  addToGroup: (childId, groupId) => {
    const s = get()
    const child = s.nodes.find((n) => n.id === childId)
    if (!child || child.id === groupId) return
    // First group → primary parent. Additional groups → extra_group_ids on data.
    if (!child.parent_id) {
      get().setParent(childId, groupId)
      return
    }
    if (child.parent_id === groupId) return
    const data = (child.data ?? {}) as Record<string, unknown>
    const extras = Array.isArray(data.extra_group_ids) ? (data.extra_group_ids as string[]) : []
    if (extras.includes(groupId)) return
    const nextData = { ...data, extra_group_ids: [...extras, groupId] }
    get().updateNode(childId, { data: nextData as FlowNode['data'] })
  },

  removeFromGroup: (childId, groupId) => {
    const s = get()
    const child = s.nodes.find((n) => n.id === childId)
    if (!child) return
    const data = (child.data ?? {}) as Record<string, unknown>
    const extras = Array.isArray(data.extra_group_ids) ? (data.extra_group_ids as string[]) : []
    if (extras.includes(groupId)) {
      const nextData = { ...data, extra_group_ids: extras.filter((g) => g !== groupId) }
      get().updateNode(childId, { data: nextData as FlowNode['data'] })
      return
    }
    if (child.parent_id === groupId) {
      // Promote first extra to primary parent if any.
      if (extras.length > 0) {
        const [next, ...rest] = extras
        const nextData = { ...data, extra_group_ids: rest }
        get().updateNode(childId, { data: nextData as FlowNode['data'] })
        get().setParent(childId, next)
      } else {
        get().setParent(childId, null)
      }
    }
  },

  getChildNodes: (parentId) => {
    return get().nodes.filter((n) => n.parent_id === parentId)
  },

  getCollapsedNodeIds: () => {
    const { nodes } = get()
    const collapsedGroups = new Set(
      nodes.filter((n) => n.type === 'grouple' && (n.data as any)?.collapsed).map((n) => n.id)
    )
    const hidden = new Set<string>()
    const hide = (parentId: string) => {
      for (const n of nodes) {
        if (n.parent_id === parentId && !hidden.has(n.id)) {
          hidden.add(n.id)
          hide(n.id) // recursively hide descendants
        }
      }
    }
    for (const gId of collapsedGroups) hide(gId)
    return hidden
  },

  clearCanvas: () => set({ nodes: [], connections: [], selectedNodeIds: [] }),
}))
