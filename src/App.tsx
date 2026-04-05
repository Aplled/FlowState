import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from '@/components/tabs/TabBar'
import { Canvas } from '@/components/canvas/Canvas'
import { TaskView } from '@/components/views/TaskView'
import { CalendarView } from '@/components/views/CalendarView'
import { SearchView } from '@/components/views/SearchView'
import { GraphView } from '@/components/views/GraphView'
import { ExpandedNodeContent } from '@/components/views/ExpandedNodeView'
import { CommandPalette } from '@/components/CommandPalette'
import { ASBPanel } from '@/components/asb/ASBPanel'
import { QuickCapture } from '@/components/asb/QuickCapture'
import { AuthProvider } from '@/lib/auth-provider'
import { useAuth, isSupabaseConfigured } from '@/lib/auth'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { useTabStore, type PaneId } from '@/stores/tab-store'
import { useThemeStore } from '@/stores/theme-store'
import { useFolderStore } from '@/stores/folder-store'

/** Renders the content for the active tab in a given pane */
function PaneContent({ pane }: { pane: PaneId }) {
  const activeTabId = useTabStore((s) => s.paneActiveTab[pane])
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === activeTabId))

  if (!activeTab) {
    // Main pane always shows canvas by default
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
    case 'workspace':
    default:
      return <Canvas />
  }
}

/**
 * Full-screen drop overlay that appears while dragging a tab.
 * Shows visual zones over the main editor area for split up/down.
 */
function DropOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const draggingTabId = useTabStore((s) => s.draggingTabId)
  const dropZone = useTabStore((s) => s.dropZone)
  const splitOpen = useTabStore((s) => s.splitOpen)
  const setDropZone = useTabStore((s) => s.setDropZone)
  const moveTabToPane = useTabStore((s) => s.moveTabToPane)
  const setDraggingTab = useTabStore((s) => s.setDraggingTab)
  const tabPaneMap = useTabStore((s) => s.tabPaneMap)

  // Use refs for values needed in the window listener to avoid stale closures
  const dropZoneRef = useRef(dropZone)
  const draggingTabIdRef = useRef(draggingTabId)
  dropZoneRef.current = dropZone
  draggingTabIdRef.current = draggingTabId

  // Attach window-level mousemove/mouseup so we capture events everywhere
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
      {/* Top drop zone indicator */}
      {splitOpen && (
        <div
          className={`absolute left-0 right-0 top-0 transition-all duration-150 ${
            dropZone === 'top' ? 'h-[45%] opacity-100' : 'h-0 opacity-0'
          }`}
        >
          <div className="absolute inset-0 bg-accent/15 border-2 border-accent/40 rounded-lg m-1" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-accent/20 backdrop-blur-sm text-accent text-xs font-medium px-3 py-1.5 rounded-md border border-accent/30">
              Move to Main
            </div>
          </div>
        </div>
      )}

      {/* Bottom drop zone indicator */}
      <div
        className={`absolute left-0 right-0 bottom-0 transition-all duration-150 ${
          dropZone === 'bottom' ? 'h-[45%] opacity-100' : 'h-0 opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-accent/15 border-2 border-accent/40 rounded-lg m-1" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-accent/20 backdrop-blur-sm text-accent text-xs font-medium px-3 py-1.5 rounded-md border border-accent/30">
            Split Down
          </div>
        </div>
      </div>

      {/* Main area indicator when no zone active */}
      {!dropZone && (
        <div className="absolute inset-0 border-2 border-accent/20 rounded-lg m-1" />
      )}
    </div>
  )
}

/** Resize handle between split panes */
function SplitResizeHandle() {
  const setSplitRatio = useTabStore((s) => s.setSplitRatio)
  const [active, setActive] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

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
      ref={containerRef}
      className={`relative h-1 shrink-0 cursor-row-resize group z-10 ${active ? 'bg-accent' : ''}`}
      onMouseDown={onMouseDown}
    >
      <div className={`absolute inset-x-0 -top-1 -bottom-1 ${active ? '' : 'group-hover:bg-accent/40'} transition`} />
      {/* Visible bar */}
      <div className={`absolute inset-x-4 top-0 h-full rounded-full transition ${
        active ? 'bg-accent' : 'bg-border group-hover:bg-accent/60'
      }`} />
      {/* Grip dots */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <div className="w-1 h-1 rounded-full bg-text-muted" />
        <div className="w-1 h-1 rounded-full bg-text-muted" />
        <div className="w-1 h-1 rounded-full bg-text-muted" />
      </div>
    </div>
  )
}

function MainApp() {
  const splitOpen = useTabStore((s) => s.splitOpen)
  const splitRatio = useTabStore((s) => s.splitRatio)
  const draggingTabId = useTabStore((s) => s.draggingTabId)
  const mainAreaRef = useRef<HTMLDivElement>(null)
  const initTheme = useThemeStore((s) => s.initTheme)
  const { user } = useAuth()

  useEffect(() => { initTheme() }, [initTheme])

  // Wire auth user into folder store so DB queries include owner_id
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const { setUserId, fetchFolders } = useFolderStore.getState()
    setUserId(user.id)
    fetchFolders()
  }, [user])

  return (
    <div className="flex h-screen w-screen bg-bg">
      <CommandPalette />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main pane tab bar */}
        <TabBar pane="main" />
        <div className="flex-1 relative min-h-0 flex">
          {/* Editor area (main + optional split) */}
          <div ref={mainAreaRef} className="flex-1 min-w-0 flex flex-col relative">
            {/* Main pane */}
            <div
              className="min-h-0 overflow-hidden relative"
              style={splitOpen ? { flex: `0 0 ${splitRatio * 100}%` } : { flex: '1 1 auto' }}
            >
              <div className="absolute inset-0">
                <PaneContent pane="main" />
              </div>
            </div>

            {/* Split pane */}
            {splitOpen && (
              <>
                <SplitResizeHandle />
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <TabBar pane="split" />
                  <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0">
                      <PaneContent pane="split" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Drop overlay */}
            {draggingTabId && <DropOverlay containerRef={mainAreaRef} />}
          </div>

        </div>
      </div>
      <ASBPanel />
      <QuickCapture />
    </div>
  )
}

function AppWithAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return <MainApp />
  }

  if (!user) {
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
