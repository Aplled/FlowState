import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Folder, Workspace } from '@/types/database'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const now = () => new Date().toISOString()

interface FolderState {
  folders: Folder[]
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  sidebarOpen: boolean

  toggleSidebar: () => void
  setActiveWorkspace: (id: string) => void

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

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  fetchFolders: async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase.from('folders').select('*').order('created_at')
    if (data) set({ folders: data as Folder[] })
  },

  fetchWorkspaces: async (folderId) => {
    if (!isSupabaseConfigured) {
      // Already in local state
      return
    }
    const { data } = await supabase.from('workspaces').select('*').eq('folder_id', folderId).order('created_at')
    if (data) {
      set((s) => {
        const others = s.workspaces.filter((w) => w.folder_id !== folderId)
        return { workspaces: [...others, ...(data as Workspace[])] }
      })
    }
  },

  createFolder: async (name) => {
    const folder: Folder = {
      id: nanoid(),
      name,
      color: '#6366f1',
      created_at: now(),
      updated_at: now(),
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('folders').insert(folder).select().single()
      if (error) throw error
      const created = data as Folder
      set((s) => ({ folders: [...s.folders, created] }))
      return created
    }

    set((s) => ({ folders: [...s.folders, folder] }))
    return folder
  },

  updateFolder: async (id, updates) => {
    if (isSupabaseConfigured) {
      await supabase.from('folders').update(updates).eq('id', id)
    }
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }))
  },

  deleteFolder: async (id) => {
    if (isSupabaseConfigured) {
      await supabase.from('folders').delete().eq('id', id)
    }
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      workspaces: s.workspaces.filter((w) => w.folder_id !== id),
    }))
  },

  createWorkspace: async (name, folderId, parentId) => {
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

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('workspaces').insert(workspace).select().single()
      if (error) throw error
      const created = data as Workspace
      set((s) => ({ workspaces: [...s.workspaces, created] }))
      return created
    }

    set((s) => ({ workspaces: [...s.workspaces, workspace] }))
    return workspace
  },

  updateWorkspace: async (id, updates) => {
    if (isSupabaseConfigured) {
      await supabase.from('workspaces').update(updates).eq('id', id)
    }
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }))
  },

  deleteWorkspace: async (id) => {
    if (isSupabaseConfigured) {
      await supabase.from('workspaces').delete().eq('id', id)
    }
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    }))
  },
}))
