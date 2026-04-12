import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Folder, Workspace } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase'
import * as db from '@/lib/db'

const now = () => new Date().toISOString()

interface FolderState {
  folders: Folder[]
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  sidebarOpen: boolean
  userId: string | null

  toggleSidebar: () => void
  setActiveWorkspace: (id: string) => void
  setUserId: (id: string | null) => void

  fetchFolders: () => Promise<void>
  fetchWorkspaces: (folderId: string) => Promise<void>
  fetchAllWorkspaces: () => Promise<void>

  createFolder: (name: string) => Promise<Folder>
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>

  createWorkspace: (name: string, folderId: string, parentId?: string) => Promise<Workspace>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  workspaces: [],
  activeWorkspaceId: null,
  sidebarOpen: true,
  userId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setUserId: (id) => set({ userId: id }),

  fetchFolders: async () => {
    const { userId } = get()
    if (!isSupabaseConfigured || !userId) return
    try {
      const data = await db.fetchFolders(userId)
      set({ folders: data as Folder[] })
    } catch (err) {
      console.error('Failed to fetch folders:', err)
    }
  },

  fetchAllWorkspaces: async () => {
    const { userId } = get()
    if (!isSupabaseConfigured || !userId) return
    try {
      const data = await db.fetchAllWorkspaces(userId)
      set((s) => {
        // Merge: keep any optimistic/local workspaces not yet persisted.
        const fetchedIds = new Set((data as Workspace[]).map((w) => w.id))
        const unfetched = s.workspaces.filter((w) => !fetchedIds.has(w.id))
        return { workspaces: [...unfetched, ...(data as Workspace[])] }
      })
    } catch (err) {
      console.error('Failed to fetch all workspaces:', err)
    }
  },

  fetchWorkspaces: async (folderId) => {
    if (!isSupabaseConfigured) return
    try {
      const data = await db.fetchWorkspaces(folderId)
      set((s) => {
        const others = s.workspaces.filter((w) => w.folder_id !== folderId)
        return { workspaces: [...others, ...(data as Workspace[])] }
      })
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
    }
  },

  createFolder: async (name) => {
    const { userId } = get()
    const folder: Folder = {
      id: nanoid(),
      name,
      color: '#6366f1',
      created_at: now(),
      updated_at: now(),
    }

    // Optimistic update
    set((s) => ({ folders: [...s.folders, folder] }))

    if (isSupabaseConfigured && userId) {
      try {
        const created = await db.createFolder({ ...folder, owner_id: userId })
        // Replace optimistic with server version
        set((s) => ({ folders: s.folders.map((f) => (f.id === folder.id ? (created as Folder) : f)) }))
        return created as Folder
      } catch (err) {
        // Rollback
        set((s) => ({ folders: s.folders.filter((f) => f.id !== folder.id) }))
        throw err
      }
    }

    return folder
  },

  updateFolder: async (id, updates) => {
    // Optimistic
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }))
    if (isSupabaseConfigured) {
      try { await db.updateFolder(id, updates) } catch (err) { console.error('Failed to update folder:', err) }
    }
  },

  deleteFolder: async (id) => {
    const prev = get()
    // Optimistic
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      workspaces: s.workspaces.filter((w) => w.folder_id !== id),
    }))
    if (isSupabaseConfigured) {
      try { await db.deleteFolder(id) } catch (err) {
        console.error('Failed to delete folder:', err)
        set({ folders: prev.folders, workspaces: prev.workspaces })
      }
    }
  },

  createWorkspace: async (name, folderId, parentId) => {
    const { userId } = get()
    const workspace: Workspace = {
      id: nanoid(),
      folder_id: folderId,
      parent_workspace_id: parentId ?? null,
      name,
      viewport_x: 0,
      viewport_y: 0,
      viewport_zoom: 1,
      created_at: now(),
      updated_at: now(),
    }

    // Optimistic
    set((s) => ({ workspaces: [...s.workspaces, workspace] }))

    if (isSupabaseConfigured && userId) {
      try {
        const created = await db.createWorkspace({ ...workspace, owner_id: userId })
        set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === workspace.id ? (created as Workspace) : w)) }))
        return created as Workspace
      } catch (err) {
        set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== workspace.id) }))
        throw err
      }
    }

    return workspace
  },

  updateWorkspace: async (id, updates) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }))
    if (isSupabaseConfigured) {
      try { await db.updateWorkspace(id, updates) } catch (err) { console.error('Failed to update workspace:', err) }
    }
  },

  deleteWorkspace: async (id) => {
    const prev = get()

    // Recursively collect this workspace and all of its embedded descendants.
    const toDelete = new Set<string>([id])
    let added = true
    while (added) {
      added = false
      for (const w of prev.workspaces) {
        if (w.parent_workspace_id && toDelete.has(w.parent_workspace_id) && !toDelete.has(w.id)) {
          toDelete.add(w.id)
          added = true
        }
      }
    }

    set((s) => ({
      workspaces: s.workspaces.filter((w) => !toDelete.has(w.id)),
      activeWorkspaceId: s.activeWorkspaceId && toDelete.has(s.activeWorkspaceId) ? null : s.activeWorkspaceId,
    }))

    // Close any open tabs that point at deleted workspaces.
    const { useTabStore } = await import('@/stores/tab-store')
    const tabState = useTabStore.getState()
    const ghostTabs = tabState.tabs.filter(
      (t) => t.kind === 'workspace' && t.targetId && toDelete.has(t.targetId),
    )
    for (const tab of ghostTabs) {
      useTabStore.getState().closeTab(tab.id)
    }

    // Clean up node-store state: drop nodes that lived in any deleted workspace
    // and any tab nodes that pointed at them (from elsewhere on the canvas).
    // Clean up node-store state: drop nodes that lived in any deleted workspace.
    // Tab nodes on *other* workspaces that pointed at the deleted workspace(s)
    // are kept as inert placeholders so connections stay intact — the TabNode
    // component detects the missing workspace and renders a "deleted" state.
    const { useNodeStore } = await import('@/stores/node-store')
    useNodeStore.setState((s) => ({
      allNodes: s.allNodes.filter((n) => !toDelete.has(n.workspace_id)),
      nodes: s.nodes.filter((n) => !toDelete.has(n.workspace_id)),
      allConnections: s.allConnections.filter((c) => !toDelete.has(c.workspace_id)),
      connections: s.connections.filter((c) => !toDelete.has(c.workspace_id)),
    }))

    if (isSupabaseConfigured) {
      try {
        // Delete child workspaces first so parent FK cascades cleanly.
        const ordered = Array.from(toDelete).sort((a, b) => {
          const aw = prev.workspaces.find((w) => w.id === a)
          const bw = prev.workspaces.find((w) => w.id === b)
          return (bw?.parent_workspace_id ? 1 : 0) - (aw?.parent_workspace_id ? 1 : 0)
        })
        for (const wsId of ordered) await db.deleteWorkspace(wsId)
      } catch (err) {
        console.error('Failed to delete workspace:', err)
        set({ workspaces: prev.workspaces })
      }
    }
  },
}))
