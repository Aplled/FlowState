import { create } from 'zustand'
import { nanoid } from 'nanoid'

export type TabKind = 'workspace' | 'expanded-node' | 'task-view' | 'calendar-view'

export interface AppTab {
  id: string
  kind: TabKind
  label: string
  /** workspace ID when kind='workspace', node ID when kind='expanded-node' */
  targetId?: string
  closable: boolean
}

export type GlobalPanel = 'tasks' | 'calendar' | null

/** Which pane a tab lives in */
export type PaneId = 'main' | 'split'

/** Drop zone shown while dragging a tab */
export type DropZone = 'top' | 'bottom' | null

interface TabState {
  tabs: AppTab[]
  activeTabId: string | null

  /** Which pane each tab belongs to — absent means 'main' */
  tabPaneMap: Record<string, PaneId>
  /** Active tab ID per pane */
  paneActiveTab: Record<PaneId, string | null>
  /** Whether the split pane is visible */
  splitOpen: boolean
  /** Height ratio of main pane (0-1), split gets the rest */
  splitRatio: number

  /** Global panel (tasks/calendar) — overlays the canvas */
  globalPanel: GlobalPanel

  /** Drop zone indicator during tab drag */
  dropZone: DropZone
  /** Tab ID currently being dragged */
  draggingTabId: string | null

  openTab: (tab: Omit<AppTab, 'id'>, pane?: PaneId) => string
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void

  openWorkspace: (wsId: string, label: string) => void
  openExpandedNode: (nodeId: string, label: string) => void
  toggleGlobalPanel: (panel: 'tasks' | 'calendar') => void

  /** Move a tab to a different pane */
  moveTabToPane: (tabId: string, pane: PaneId) => void
  /** Close the split pane (moves all tabs back to main) */
  closeSplit: () => void
  /** Set split ratio */
  setSplitRatio: (ratio: number) => void

  /** Drag state */
  setDraggingTab: (tabId: string | null) => void
  setDropZone: (zone: DropZone) => void
}

const TASKS_TAB: AppTab = { id: '__tasks__', kind: 'task-view', label: 'All Tasks', closable: false }
const CALENDAR_TAB: AppTab = { id: '__calendar__', kind: 'calendar-view', label: 'Calendar', closable: false }

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [TASKS_TAB, CALENDAR_TAB],
  activeTabId: null,
  tabPaneMap: {},
  paneActiveTab: { main: null, split: null },
  splitOpen: false,
  splitRatio: 0.5,
  globalPanel: null,
  dropZone: null,
  draggingTabId: null,

  openTab: (tabDef, pane = 'main') => {
    const id = nanoid(8)
    const tab: AppTab = { ...tabDef, id }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
      tabPaneMap: { ...s.tabPaneMap, [id]: pane },
      paneActiveTab: { ...s.paneActiveTab, [pane]: id },
    }))
    return id
  },

  closeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      const pane = s.tabPaneMap[id] ?? 'main'
      const { [id]: _, ...tabPaneMap } = s.tabPaneMap

      // Find new active tab for pane
      const paneTabs = tabs.filter((t) => (tabPaneMap[t.id] ?? 'main') === pane)
      const paneActiveTab = { ...s.paneActiveTab }
      if (paneActiveTab[pane] === id) {
        paneActiveTab[pane] = paneTabs.length > 0 ? paneTabs[paneTabs.length - 1].id : null
      }

      // Update global activeTabId
      let activeTabId = s.activeTabId
      if (activeTabId === id) {
        activeTabId = paneActiveTab[pane] ?? paneActiveTab[pane === 'main' ? 'split' : 'main'] ?? null
      }

      // Close split if no tabs in it
      const splitTabs = tabs.filter((t) => (tabPaneMap[t.id] ?? 'main') === 'split')
      const splitOpen = splitTabs.length > 0

      return { tabs, activeTabId, tabPaneMap, paneActiveTab, splitOpen }
    })
  },

  setActiveTab: (id) => {
    set((s) => {
      const pane = s.tabPaneMap[id] ?? 'main'
      return {
        activeTabId: id,
        paneActiveTab: { ...s.paneActiveTab, [pane]: id },
      }
    })
  },

  openWorkspace: (wsId, label) => {
    const existing = get().tabs.find((t) => t.kind === 'workspace' && t.targetId === wsId)
    if (existing) {
      get().setActiveTab(existing.id)
      return
    }
    get().openTab({ kind: 'workspace', label, targetId: wsId, closable: true })
  },

  openExpandedNode: (nodeId, label) => {
    const existing = get().tabs.find((t) => t.kind === 'expanded-node' && t.targetId === nodeId)
    if (existing) {
      get().setActiveTab(existing.id)
      return
    }
    get().openTab({ kind: 'expanded-node', label, targetId: nodeId, closable: true })
  },

  toggleGlobalPanel: (panel) => {
    const tabId = panel === 'tasks' ? '__tasks__' : '__calendar__'
    const current = get().paneActiveTab['main']
    if (current === tabId) {
      // Already viewing it — switch back to the last workspace tab
      const lastWs = get().tabs.find((t) => t.kind === 'workspace')
      if (lastWs) get().setActiveTab(lastWs.id)
      return
    }
    get().setActiveTab(tabId)
  },

  moveTabToPane: (tabId, pane) => {
    set((s) => {
      const oldPane = s.tabPaneMap[tabId] ?? 'main'
      if (oldPane === pane) return {}

      const tabPaneMap = { ...s.tabPaneMap, [tabId]: pane }

      // Update active tabs for both panes
      const paneActiveTab = { ...s.paneActiveTab, [pane]: tabId }

      // If old pane lost its active tab, pick another
      if (s.paneActiveTab[oldPane] === tabId) {
        const remaining = s.tabs.filter((t) => t.id !== tabId && (tabPaneMap[t.id] ?? 'main') === oldPane)
        paneActiveTab[oldPane] = remaining.length > 0 ? remaining[remaining.length - 1].id : null
      }

      const splitOpen = pane === 'split' || s.tabs.some((t) => (tabPaneMap[t.id] ?? 'main') === 'split')

      return {
        tabPaneMap,
        paneActiveTab,
        splitOpen,
        activeTabId: tabId,
      }
    })
  },

  closeSplit: () => {
    set((s) => {
      const tabPaneMap: Record<string, PaneId> = {}
      for (const tab of s.tabs) {
        tabPaneMap[tab.id] = 'main'
      }
      const lastTab = s.tabs[s.tabs.length - 1]
      return {
        tabPaneMap,
        splitOpen: false,
        paneActiveTab: { main: s.paneActiveTab.main ?? s.paneActiveTab.split ?? lastTab?.id ?? null, split: null },
      }
    })
  },

  setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.2, Math.min(0.8, ratio)) }),

  setDraggingTab: (tabId) => set({ draggingTabId: tabId, dropZone: null }),
  setDropZone: (zone) => set({ dropZone: zone }),
}))
