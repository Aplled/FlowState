import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Folder, Workspace } from '@/types/database'

interface FolderState {
  folders: Folder[]
  workspaces: Workspace[]
  activeFolderId: string | null
  activeWorkspaceId: string | null
  openTabs: string[] // workspace IDs

  fetchFolders: () => Promise<void>
  createFolder: (name: string, parentId?: string) => Promise<Folder>
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>

  fetchWorkspaces: (folderId: string) => Promise<void>
  createWorkspace: (name: string, folderId: string) => Promise<Workspace>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>

  setActiveFolder: (id: string | null) => void
  setActiveWorkspace: (id: string | null) => void
  openTab: (workspaceId: string) => void
  closeTab: (workspaceId: string) => void
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  workspaces: [],
  activeFolderId: null,
  activeWorkspaceId: null,
  openTabs: [],

  fetchFolders: async () => {
    const { data } = await supabase
      .from('folders')
      .select('*')
      .order('sort_order')
    if (data) set({ folders: data })
  },

  createFolder: async (name, parentId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('folders')
      .insert({ name, parent_id: parentId ?? null, owner_id: user.id })
      .select()
      .single()

    if (error) throw error
    set((s) => ({ folders: [...s.folders, data] }))
    return data
  },

  updateFolder: async (id, updates) => {
    const { error } = await supabase.from('folders').update(updates).eq('id', id)
    if (error) throw error
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }))
  },

  deleteFolder: async (id) => {
    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) throw error
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      activeFolderId: s.activeFolderId === id ? null : s.activeFolderId,
    }))
  },

  fetchWorkspaces: async (folderId) => {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('folder_id', folderId)
      .order('sort_order')
    if (data) set({ workspaces: data })
  },

  createWorkspace: async (name, folderId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name, folder_id: folderId, owner_id: user.id })
      .select()
      .single()

    if (error) throw error
    set((s) => ({ workspaces: [...s.workspaces, data] }))
    return data
  },

  updateWorkspace: async (id, updates) => {
    const { error } = await supabase.from('workspaces').update(updates).eq('id', id)
    if (error) throw error
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }))
  },

  deleteWorkspace: async (id) => {
    const { error } = await supabase.from('workspaces').delete().eq('id', id)
    if (error) throw error
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      openTabs: s.openTabs.filter((t) => t !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    }))
  },

  setActiveFolder: (id) => set({ activeFolderId: id }),

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id })
    if (id) get().openTab(id)
  },

  openTab: (workspaceId) => {
    set((s) => ({
      openTabs: s.openTabs.includes(workspaceId)
        ? s.openTabs
        : [...s.openTabs, workspaceId],
    }))
  },

  closeTab: (workspaceId) => {
    set((s) => {
      const newTabs = s.openTabs.filter((t) => t !== workspaceId)
      return {
        openTabs: newTabs,
        activeWorkspaceId:
          s.activeWorkspaceId === workspaceId
            ? newTabs[newTabs.length - 1] ?? null
            : s.activeWorkspaceId,
      }
    })
  },
}))
