import { useCallback, useMemo, useRef } from 'react'
import { useTabStore, type AppTab, type PaneId } from '@/stores/tab-store'
import { useFolderStore } from '@/stores/folder-store'
import { X, CheckSquare, Calendar, Layout, Maximize2, Search, GitFork, Settings, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const kindIcons: Record<string, React.ReactNode> = {
  workspace: <Layout className="h-3 w-3" />,
  'expanded-node': <Maximize2 className="h-3 w-3" />,
  'task-view': <CheckSquare className="h-3 w-3" />,
  'calendar-view': <Calendar className="h-3 w-3" />,
  search: <Search className="h-3 w-3" />,
  'graph-view': <GitFork className="h-3 w-3" />,
  settings: <Settings className="h-3 w-3" />,
  'kanban-view': <LayoutGrid className="h-3 w-3" />,
}

interface TabBarProps {
  pane: PaneId
}

export function TabBar({ pane }: TabBarProps) {
  const allTabs = useTabStore((s) => s.tabs)
  const tabPaneMap = useTabStore((s) => s.tabPaneMap)
  const hiddenKinds = new Set(['task-view', 'calendar-view', 'search', 'graph-view', 'settings', 'kanban-view'])
  const tabs = useMemo(() => allTabs.filter((t) =>
    (tabPaneMap[t.id] ?? 'main') === pane && !hiddenKinds.has(t.kind)
  ), [allTabs, tabPaneMap, pane])
  const activeTabId = useTabStore((s) => s.paneActiveTab[pane])
  const { setActiveTab, closeTab, setDraggingTab, draggingTabId } = useTabStore()
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
        setTimeout(() => setDraggingTab(null), 50)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setDraggingTab])

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center h-8 bg-bg-secondary border-b border-border/50 overflow-x-auto shrink-0">
      <div className="flex items-center flex-1 overflow-x-auto gap-0 px-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleClick(tab)}
            onMouseDown={(e) => onTabMouseDown(e, tab.id)}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-1 text-[11px] cursor-pointer min-w-0 max-w-[180px] select-none transition-colors border-b-2',
              tab.id === activeTabId
                ? 'bg-bg text-text border-accent'
                : 'text-text-muted hover:bg-bg-hover hover:text-text border-transparent',
              draggingTabId === tab.id && 'opacity-50',
            )}
          >
            <span className="shrink-0 opacity-50">{kindIcons[tab.kind]}</span>
            <span className="truncate">{tab.label}</span>
            {tab.closable && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="shrink-0 ml-auto rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-active cursor-pointer transition-opacity"
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
