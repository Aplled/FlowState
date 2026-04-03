import { create } from 'zustand'

type View = 'canvas' | 'tasks' | 'calendar' | 'graph' | 'search' | 'recents' | 'shared'
type Theme = 'light' | 'dark' | 'system'

interface UiState {
  sidebarOpen: boolean
  sidebarWidth: number
  commandPaletteOpen: boolean
  currentView: View
  theme: Theme
  splitScreen: boolean
  splitWorkspaceId: string | null

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleCommandPalette: () => void
  setView: (view: View) => void
  setTheme: (theme: Theme) => void
  toggleSplitScreen: (workspaceId?: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 260,
  commandPaletteOpen: false,
  currentView: 'canvas',
  theme: 'dark',
  splitScreen: false,
  splitWorkspaceId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setView: (view) => set({ currentView: view }),
  setTheme: (theme) => set({ theme }),
  toggleSplitScreen: (workspaceId) =>
    set((s) => ({
      splitScreen: !s.splitScreen,
      splitWorkspaceId: s.splitScreen ? null : workspaceId ?? null,
    })),
}))
