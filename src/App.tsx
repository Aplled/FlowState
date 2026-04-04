import { useCallback, useRef, useState } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from '@/components/tabs/TabBar'
import { Canvas } from '@/components/canvas/Canvas'
import { TaskView } from '@/components/views/TaskView'
import { CalendarView } from '@/components/views/CalendarView'
import { ExpandedNodeContent } from '@/components/views/ExpandedNodeView'
import { useTabStore, type PaneId } from '@/stores/tab-store'
import { X } from 'lucide-react'

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
    case 'workspace':
    default:
      return <Canvas />
  }
}

function GlobalPanel() {
  const globalPanel = useTabStore((s) => s.globalPanel)
  const toggleGlobalPanel = useTabStore((s) => s.toggleGlobalPanel)

  if (!globalPanel) return null

  return (
    <div className="h-full border-l border-border bg-bg flex flex-col" style={{ width: 480 }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-medium text-text">
          {globalPanel === 'tasks' ? 'All Tasks' : 'Calendar'}
        </span>
        <button
          onClick={() => toggleGlobalPanel(globalPanel)}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {globalPanel === 'tasks' ? <TaskView /> : <CalendarView />}
      </div>
    </div>
  )
}

/** Drop zone overlay shown when dragging a tab */
function DropOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { draggingTabId, dropZone, setDropZone, moveTabToPane, setDraggingTab, splitOpen } = useTabStore()

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingTabId || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const relY = (e.clientY - rect.top) / rect.height
    // Bottom 30% = split zone
    setDropZone(relY > 0.7 ? 'bottom' : null)
  }, [draggingTabId, containerRef, setDropZone])

  const handleMouseUp = useCallback(() => {
    if (!draggingTabId) return
    if (dropZone === 'bottom') {
      const currentPane = useTabStore.getState().tabPaneMap[draggingTabId] ?? 'main'
      const targetPane: PaneId = currentPane === 'split' ? 'split' : 'split'
      moveTabToPane(draggingTabId, targetPane)
    }
    setDraggingTab(null)
    setDropZone(null)
  }, [draggingTabId, dropZone, moveTabToPane, setDraggingTab, setDropZone])

  if (!draggingTabId) return null

  return (
    <div
      className="absolute inset-0 z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDraggingTab(null); setDropZone(null) }}
    >
      {/* Bottom drop zone indicator */}
      <div
        className={`absolute left-0 right-0 bottom-0 transition-all duration-150 pointer-events-none ${
          dropZone === 'bottom'
            ? 'h-[45%] opacity-100'
            : 'h-0 opacity-0'
        }`}
      >
        {/* VS Code-style blue highlight */}
        <div className="absolute inset-0 bg-accent/15 border-2 border-accent/40 rounded-lg m-1" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-accent/20 backdrop-blur-sm text-accent text-xs font-medium px-3 py-1.5 rounded-md border border-accent/30">
            Split Down
          </div>
        </div>
      </div>

      {/* Main area indicator when no zone active */}
      {!dropZone && (
        <div className="absolute inset-0 border-2 border-accent/20 rounded-lg m-1 pointer-events-none" />
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

export default function App() {
  const splitOpen = useTabStore((s) => s.splitOpen)
  const splitRatio = useTabStore((s) => s.splitRatio)
  const draggingTabId = useTabStore((s) => s.draggingTabId)
  const mainAreaRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-screen w-screen bg-bg">
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

          <GlobalPanel />
        </div>
      </div>
    </div>
  )
}
