import { create } from 'zustand'
import { patchUserSettings } from '@/lib/user-settings'

const STORAGE_KEY = 'flowstate-layout'

export type SidebarPosition = 'left' | 'right'
export type PanelId = 'sidebar' | 'asb' | 'minimap' | 'properties'

export interface PanelConfig {
  visible: boolean
  width: number
  collapsed: boolean
}

interface LayoutState {
  sidebarPosition: SidebarPosition
  sidebarWidth: number
  showMinimap: boolean
  showBreadcrumbs: boolean
  showTabBar: boolean
  compactNodeHeaders: boolean
  compactMode: boolean
  panels: Record<PanelId, PanelConfig>

  setSidebarPosition: (pos: SidebarPosition) => void
  setSidebarWidth: (w: number) => void
  setShowMinimap: (v: boolean) => void
  setShowBreadcrumbs: (v: boolean) => void
  setShowTabBar: (v: boolean) => void
  setCompactNodeHeaders: (v: boolean) => void
  setCompactMode: (v: boolean) => void
  togglePanel: (id: PanelId) => void
  setPanelWidth: (id: PanelId, w: number) => void
  initLayout: () => void
  hydrateFromProfile: (settings: Partial<LayoutState> | null | undefined) => void
}

const defaultPanels: Record<PanelId, PanelConfig> = {
  sidebar: { visible: true, width: 240, collapsed: false },
  asb: { visible: true, width: 320, collapsed: true },
  minimap: { visible: true, width: 180, collapsed: false },
  properties: { visible: false, width: 280, collapsed: true },
}

function loadLayout(): Partial<LayoutState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveLayout(state: Partial<LayoutState>) {
  const snapshot = {
    sidebarPosition: state.sidebarPosition,
    sidebarWidth: state.sidebarWidth,
    showMinimap: state.showMinimap,
    showBreadcrumbs: state.showBreadcrumbs,
    showTabBar: state.showTabBar,
    compactNodeHeaders: state.compactNodeHeaders,
    compactMode: state.compactMode,
    panels: state.panels,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  patchUserSettings({ layout: snapshot })
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarPosition: 'left',
  sidebarWidth: 240,
  showMinimap: true,
  showBreadcrumbs: true,
  showTabBar: true,
  compactNodeHeaders: false,
  compactMode: false,
  panels: { ...defaultPanels },

  setSidebarPosition: (pos) => { set({ sidebarPosition: pos }); saveLayout(get()) },
  setSidebarWidth: (w) => { set({ sidebarWidth: Math.max(180, Math.min(480, w)) }); saveLayout(get()) },
  setShowMinimap: (v) => { set({ showMinimap: v }); saveLayout(get()) },
  setShowBreadcrumbs: (v) => { set({ showBreadcrumbs: v }); saveLayout(get()) },
  setShowTabBar: (v) => { set({ showTabBar: v }); saveLayout(get()) },
  setCompactNodeHeaders: (v) => { set({ compactNodeHeaders: v }); saveLayout(get()) },
  setCompactMode: (v) => { set({ compactMode: v }); saveLayout(get()) },

  togglePanel: (id) => {
    set((s) => ({
      panels: {
        ...s.panels,
        [id]: { ...s.panels[id], visible: !s.panels[id].visible },
      },
    }))
    saveLayout(get())
  },

  setPanelWidth: (id, w) => {
    set((s) => ({
      panels: {
        ...s.panels,
        [id]: { ...s.panels[id], width: Math.max(160, Math.min(600, w)) },
      },
    }))
    saveLayout(get())
  },

  initLayout: () => {
    const saved = loadLayout()
    set({
      sidebarPosition: saved.sidebarPosition ?? 'left',
      sidebarWidth: saved.sidebarWidth ?? 240,
      showMinimap: saved.showMinimap ?? true,
      showBreadcrumbs: saved.showBreadcrumbs ?? true,
      showTabBar: saved.showTabBar ?? true,
      compactNodeHeaders: saved.compactNodeHeaders ?? false,
      compactMode: saved.compactMode ?? false,
      panels: { ...defaultPanels, ...(saved.panels ?? {}) },
    })
  },

  hydrateFromProfile: (settings) => {
    if (!settings) return
    const merged = {
      sidebarPosition: settings.sidebarPosition ?? get().sidebarPosition,
      sidebarWidth: settings.sidebarWidth ?? get().sidebarWidth,
      showMinimap: settings.showMinimap ?? get().showMinimap,
      showBreadcrumbs: settings.showBreadcrumbs ?? get().showBreadcrumbs,
      showTabBar: settings.showTabBar ?? get().showTabBar,
      compactNodeHeaders: settings.compactNodeHeaders ?? get().compactNodeHeaders,
      compactMode: settings.compactMode ?? get().compactMode,
      panels: { ...defaultPanels, ...(settings.panels ?? get().panels) },
    }
    set(merged)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  },
}))
