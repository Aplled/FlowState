import { useCallback, useEffect, useRef, useState } from 'react'
import { LandingPage } from '@/components/landing/LandingPage'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from '@/components/tabs/TabBar'
import { Canvas } from '@/components/canvas/Canvas'
import { TaskView } from '@/components/views/TaskView'
import { CalendarView } from '@/components/views/CalendarView'
import { SearchView } from '@/components/views/SearchView'
import { GraphView } from '@/components/views/GraphView'
import { KanbanView } from '@/components/views/KanbanView'
import { ExpandedNodeContent } from '@/components/views/ExpandedNodeView'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { CommandPalette } from '@/components/CommandPalette'
import { ASBPanel } from '@/components/asb/ASBPanel'
import { QuickCapture } from '@/components/asb/QuickCapture'
import { AuthProvider } from '@/lib/auth-provider'
import { useAuth, isSupabaseConfigured } from '@/lib/auth'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { useTabStore, type PaneId } from '@/stores/tab-store'
import { useThemeStore } from '@/stores/theme-store'
import { useLayoutStore } from '@/stores/layout-store'
import { useFolderStore } from '@/stores/folder-store'
import { useNodeStore } from '@/stores/node-store'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { isGoogleConnected } from '@/lib/google-auth'
import { syncFromGoogle, startPeriodicSync } from '@/services/sync-engine'
import { hydrateUserSettings, clearUserSettings } from '@/lib/user-settings'

/** Renders the content for the active tab in a given pane */
function PaneContent({ pane }: { pane: PaneId }) {
  const activeTabId = useTabStore((s) => s.paneActiveTab[pane])
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === activeTabId))
  const activeWorkspaceId = useFolderStore((s) => s.activeWorkspaceId)
  const [transitioning, setTransitioning] = useState(false)
  const prevKeyRef = useRef(`${activeTabId}::${activeWorkspaceId}`)

  useEffect(() => {
    const key = `${activeTabId}::${activeWorkspaceId}`
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key
      setTransitioning(true)
      const timer = setTimeout(() => setTransitioning(false), 400)
      return () => clearTimeout(timer)
    }
  }, [activeTabId, activeWorkspaceId])

  if (transitioning) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg">
        <div className="loader" />
      </div>
    )
  }

  if (!activeTab) {
    if (pane === 'main') return <Canvas />
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        No tab selected
      </div>
    )
  }

  switch (activeTab.kind) {
    case 'expanded-node':
      return <ExpandedNodeContent nodeId={activeTab.targetId!} />
    case 'task-view':
      return <TaskView />
    case 'calendar-view':
      return <CalendarView />
    case 'search':
      return <SearchView />
    case 'graph-view':
      return <GraphView />
    case 'settings':
      return <SettingsPage />
    case 'kanban-view':
      return <KanbanView />
    case 'workspace':
    default:
      return <Canvas />
  }
}

/**
 * Full-screen drop overlay that appears while dragging a tab.
 */
function DropOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const draggingTabId = useTabStore((s) => s.draggingTabId)
  const dropZone = useTabStore((s) => s.dropZone)
  const splitOpen = useTabStore((s) => s.splitOpen)
  const setDropZone = useTabStore((s) => s.setDropZone)
  const moveTabToPane = useTabStore((s) => s.moveTabToPane)
  const setDraggingTab = useTabStore((s) => s.setDraggingTab)
  const tabPaneMap = useTabStore((s) => s.tabPaneMap)

  const dropZoneRef = useRef(dropZone)
  const draggingTabIdRef = useRef(draggingTabId)
  dropZoneRef.current = dropZone
  draggingTabIdRef.current = draggingTabId

  useEffect(() => {
    if (!draggingTabId) return

    const onMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const relY = (e.clientY - rect.top) / rect.height
      const insideX = e.clientX >= rect.left && e.clientX <= rect.right

      if (!insideX || e.clientY < rect.top || e.clientY > rect.bottom) {
        setDropZone(null)
        return
      }

      if (splitOpen) {
        if (relY < 0.3) setDropZone('top')
        else if (relY > 0.7) setDropZone('bottom')
        else setDropZone(null)
      } else {
        setDropZone(relY > 0.7 ? 'bottom' : null)
      }
    }

    const onUp = () => {
      const tabId = draggingTabIdRef.current
      const zone = dropZoneRef.current
      if (tabId && zone) {
        const currentPane = useTabStore.getState().tabPaneMap[tabId] ?? 'main'
        if (zone === 'bottom' && currentPane !== 'split') {
          moveTabToPane(tabId, 'split')
        } else if (zone === 'top' && currentPane !== 'main') {
          moveTabToPane(tabId, 'main')
        }
      }
      setDraggingTab(null)
      setDropZone(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingTabId, splitOpen, containerRef, setDropZone, moveTabToPane, setDraggingTab])

  if (!draggingTabId) return null

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {splitOpen && (
        <div
          className={`absolute left-0 right-0 top-0 transition-all duration-200 ${
            dropZone === 'top' ? 'h-[45%] opacity-100' : 'h-0 opacity-0'
          }`}
        >
          <div className="absolute inset-0 bg-accent/10 border-2 border-accent/30 rounded-xl m-1" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-accent/15 text-accent text-xs font-medium px-3 py-1.5 rounded-full border border-accent/20">
              Move to Main
            </div>
          </div>
        </div>
      )}

      <div
        className={`absolute left-0 right-0 bottom-0 transition-all duration-200 ${
          dropZone === 'bottom' ? 'h-[45%] opacity-100' : 'h-0 opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-accent/10 border-2 border-accent/30 rounded-xl m-1" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-accent/15 text-accent text-xs font-medium px-3 py-1.5 rounded-full border border-accent/20">
            Split Down
          </div>
        </div>
      </div>

      {!dropZone && (
        <div className="absolute inset-0 border-2 border-accent/15 rounded-xl m-1" />
      )}
    </div>
  )
}

/** Resize handle between split panes */
function SplitResizeHandle() {
  const setSplitRatio = useTabStore((s) => s.setSplitRatio)
  const [active, setActive] = useState(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setActive(true)
    const container = (e.currentTarget as HTMLElement).parentElement!
    const rect = container.getBoundingClientRect()

    const onMove = (me: MouseEvent) => {
      const ratio = (me.clientY - rect.top) / rect.height
      setSplitRatio(ratio)
    }

    const onUp = () => {
      setActive(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setSplitRatio])

  return (
    <div
      className={`relative h-1 shrink-0 cursor-row-resize group z-10 ${active ? 'bg-accent' : ''}`}
      onMouseDown={onMouseDown}
    >
      <div className={`absolute inset-x-0 -top-1 -bottom-1 ${active ? '' : 'group-hover:bg-accent/30'} transition`} />
      <div className={`absolute inset-x-4 top-0 h-full rounded-full transition ${
        active ? 'bg-accent' : 'bg-border group-hover:bg-accent/50'
      }`} />
    </div>
  )
}

/** Resizable sidebar handle */
function SidebarResizeHandle({ onResize }: { onResize: (w: number) => void }) {
  const sidebarPosition = useLayoutStore((s) => s.sidebarPosition)
  const [active, setActive] = useState(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setActive(true)

    const onMove = (me: MouseEvent) => {
      const w = sidebarPosition === 'left' ? me.clientX : window.innerWidth - me.clientX
      onResize(w)
    }

    const onUp = () => {
      setActive(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onResize, sidebarPosition])

  return (
    <div
      className={`w-1 cursor-col-resize group relative shrink-0 ${active ? 'bg-accent' : 'hover:bg-accent/30'} transition-colors`}
      onMouseDown={onMouseDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}

function MainApp() {
  const splitOpen = useTabStore((s) => s.splitOpen)
  const splitRatio = useTabStore((s) => s.splitRatio)
  const draggingTabId = useTabStore((s) => s.draggingTabId)
  const mainAreaRef = useRef<HTMLDivElement>(null)
  const initTheme = useThemeStore((s) => s.initTheme)
  const initLayout = useLayoutStore((s) => s.initLayout)
  const sidebarPosition = useLayoutStore((s) => s.sidebarPosition)
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth)
  const showTabBar = useLayoutStore((s) => s.showTabBar)
  const sidebarOpen = useFolderStore((s) => s.sidebarOpen)
  const { user } = useAuth()

  useEffect(() => { initTheme(); initLayout() }, [initTheme, initLayout])

  // Prevent browser back/forward navigation from horizontal swipe gestures
  useEffect(() => {
    // Block horizontal overscroll navigation at the document level
    const preventNav = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
      }
    }
    // Push a dummy history entry so back gesture has nowhere to go
    window.history.pushState(null, '', window.location.href)
    const onPopState = () => {
      window.history.pushState(null, '', window.location.href)
    }
    document.addEventListener('wheel', preventNav, { passive: false })
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('wheel', preventNav)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (!user) {
      clearUserSettings()
      return
    }
    const { setUserId, fetchFolders } = useFolderStore.getState()
    setUserId(user.id)
    fetchFolders()
    useNodeStore.getState().fetchAllData()
    hydrateUserSettings(user.id).then((settings) => {
      const s = settings as { theme?: Parameters<ReturnType<typeof useThemeStore.getState>['hydrateFromProfile']>[0]; layout?: Parameters<ReturnType<typeof useLayoutStore.getState>['hydrateFromProfile']>[0] }
      if (s.theme) useThemeStore.getState().hydrateFromProfile(s.theme)
      if (s.layout) useLayoutStore.getState().hydrateFromProfile(s.layout)
    })
  }, [user])

  // Auto-sync calendar on startup
  useEffect(() => {
    isGoogleConnected().then((connected) => {
      if (!connected) return
      const { selectedCalendarId, syncFrequencyMs, setConnected } = useCalendarSyncStore.getState()
      setConnected(true)
      if (selectedCalendarId) {
        syncFromGoogle().catch((err) => console.error('Startup calendar sync failed:', err))
        if (syncFrequencyMs > 0) startPeriodicSync(syncFrequencyMs)
      }
    })
  }, [])

  const sidebarEl = (
    <>
      <div
        style={{ width: sidebarOpen ? sidebarWidth : 36 }}
        className="shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
      >
        <Sidebar />
      </div>
      {sidebarOpen && <SidebarResizeHandle onResize={setSidebarWidth} />}
    </>
  )

  return (
    <div className="flex h-screen w-screen bg-bg">
      <CommandPalette />

      {sidebarPosition === 'left' && sidebarEl}

      <div className="flex-1 flex flex-col min-w-0">
        {showTabBar && <TabBar pane="main" />}
        <div className="flex-1 relative min-h-0 flex">
          <div ref={mainAreaRef} className="flex-1 min-w-0 flex flex-col relative">
            <div
              className="min-h-0 overflow-hidden relative"
              style={splitOpen ? { flex: `0 0 ${splitRatio * 100}%` } : { flex: '1 1 auto' }}
            >
              <div className="absolute inset-0">
                <PaneContent pane="main" />
              </div>
            </div>

            {splitOpen && (
              <>
                <SplitResizeHandle />
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {showTabBar && <TabBar pane="split" />}
                  <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0">
                      <PaneContent pane="split" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {draggingTabId && <DropOverlay containerRef={mainAreaRef} />}
          </div>
        </div>
      </div>

      {sidebarPosition === 'right' && sidebarEl}

      <ASBPanel />
      <QuickCapture />
    </div>
  )
}

function AppWithAuth() {
  const { user, loading } = useAuth()
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const [showLanding, setShowLanding] = useState(() => {
    if (isTauri) return false
    return !localStorage.getItem('flowstate-onboarded')
  })

  const dismissLanding = useCallback(() => {
    localStorage.setItem('flowstate-onboarded', '1')
    setShowLanding(false)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="loader" />
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (showLanding) {
    return <LandingPage onGetStarted={dismissLanding} />
  }

  if (isSupabaseConfigured && !user) {
    return <AuthScreen />
  }

  return <MainApp />
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  )
}
