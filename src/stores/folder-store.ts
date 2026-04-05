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
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    }))
    if (isSupabaseConfigured) {
      try { await db.deleteWorkspace(id) } catch (err) {
        console.error('Failed to delete workspace:', err)
        set({ workspaces: prev.workspaces })
      }
    }
  },
}))
