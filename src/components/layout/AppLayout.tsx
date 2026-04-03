import { ReactFlowProvider } from '@xyflow/react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from './TabBar'
import { CommandPalette } from './CommandPalette'
import { Canvas } from '@/components/canvas/Canvas'
import { TaskListView } from '@/components/views/TaskListView'
import { CalendarView } from '@/components/views/CalendarView'
import { GraphView } from '@/components/views/GraphView'
import { SearchView } from '@/components/views/SearchView'
import { useUiStore } from '@/stores/ui-store'
import { useFolderStore } from '@/stores/folder-store'
import { useRealtimeSync, useRealtimeFolders } from '@/hooks/use-realtime'

function ViewContent() {
  const currentView = useUiStore((s) => s.currentView)

  switch (currentView) {
    case 'tasks':
      return <TaskListView />
    case 'calendar':
      return <CalendarView />
    case 'graph':
      return <GraphView />
    case 'search':
      return <SearchView />
    case 'recents':
      return (
        <div className="flex h-full items-center justify-center text-text-muted">
          <p>Recents view coming soon</p>
        </div>
      )
    case 'shared':
      return (
        <div className="flex h-full items-center justify-center text-text-muted">
          <p>Shared with Me coming soon</p>
        </div>
      )
    default:
      return (
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      )
  }
}

export function AppLayout() {
  const activeWorkspaceId = useFolderStore((s) => s.activeWorkspaceId)
  useRealtimeSync(activeWorkspaceId)
  useRealtimeFolders()

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <main className="flex-1 overflow-hidden">
          <ViewContent />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
