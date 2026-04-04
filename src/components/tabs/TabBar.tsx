import { useCallback, useMemo, useRef } from 'react'
import { useTabStore, type AppTab, type PaneId } from '@/stores/tab-store'
import { useFolderStore } from '@/stores/folder-store'
import { X, CheckSquare, Calendar, Layout, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const kindIcons: Record<string, React.ReactNode> = {
  workspace: <Layout className="h-3 w-3" />,
  'expanded-node': <Maximize2 className="h-3 w-3" />,
}

interface TabBarProps {
  pane: PaneId
}

export function TabBar({ pane }: TabBarProps) {
  const allTabs = useTabStore((s) => s.tabs)
  const tabPaneMap = useTabStore((s) => s.tabPaneMap)
  const tabs = useMemo(() => allTabs.filter((t) => (tabPaneMap[t.id] ?? 'main') === pane), [allTabs, tabPaneMap, pane])
  const activeTabId = useTabStore((s) => s.paneActiveTab[pane])
  const { setActiveTab, closeTab, globalPanel, toggleGlobalPanel, setDraggingTab, draggingTabId } = useTabStore()
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)

  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  const handleClick = (tab: AppTab) => {
    setActiveTab(tab.id)
    if (tab.kind === 'workspace' && tab.targetId) {
      setActiveWorkspace(tab.targetId)
    }
  }

  const onTabMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
    if (e.button !== 0) return
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    isDragging.current = false

    const onMove = (me: MouseEvent) => {
      if (!dragStartPos.current) return
      const dx = me.clientX - dragStartPos.current.x
      const dy = me.clientY - dragStartPos.current.y
      if (!isDragging.current && Math.abs(dx) + Math.abs(dy) > 8) {
        isDragging.current = true
        setDraggingTab(tabId)
      }
    }

    const onUp = () => {
      dragStartPos.current = null
      if (isDragging.current) {
        isDragging.current = false
        // Drop is handled by the drop zone in the main area
        // Just clear dragging state after a tick so drop zone can read it
        setTimeout(() => setDraggingTab(null), 50)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setDraggingTab])

  return (
    <div className="flex items-center h-9 bg-bg-secondary border-b border-border overflow-x-auto shrink-0">
      {/* Global panel toggles (only in main pane) */}
      {pane === 'main' && (
        <div className="flex items-center gap-0.5 px-2 border-r border-border">
          <button
            onClick={() => toggleGlobalPanel('tasks')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[10px] rounded cursor-pointer transition',
              globalPanel === 'tasks' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-bg-hover',
            )}
          >
            <CheckSquare className="h-3 w-3" /> Tasks
          </button>
          <button
            onClick={() => toggleGlobalPanel('calendar')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[10px] rounded cursor-pointer transition',
              globalPanel === 'calendar' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-bg-hover',
            )}
          >
            <Calendar className="h-3 w-3" /> Calendar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleClick(tab)}
            onMouseDown={(e) => onTabMouseDown(e, tab.id)}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-r border-border cursor-pointer min-w-0 max-w-[180px] select-none',
              tab.id === activeTabId
                ? 'bg-bg text-text'
                : 'text-text-muted hover:bg-bg-hover hover:text-text',
              draggingTabId === tab.id && 'opacity-50',
            )}
          >
            <span className="shrink-0 opacity-60">{kindIcons[tab.kind]}</span>
            <span className="truncate">{tab.label}</span>
            {tab.closable && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="shrink-0 ml-auto rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-active cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
