import { useFolderStore } from '@/stores/folder-store'
import { useUiStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import { X, PanelLeft } from 'lucide-react'

export function TabBar() {
  const { openTabs, activeWorkspaceId, workspaces, setActiveWorkspace, closeTab } = useFolderStore()
  const { toggleSidebar } = useUiStore()

  return (
    <div className="flex h-10 items-center border-b border-border bg-bg-secondary" data-tauri-drag-region>
      <button
        onClick={toggleSidebar}
        className="flex h-10 w-10 items-center justify-center text-text-muted transition hover:bg-bg-hover hover:text-text"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center gap-0 overflow-x-auto">
        {openTabs.map((wsId) => {
          const ws = workspaces.find((w) => w.id === wsId)
          const isActive = activeWorkspaceId === wsId
          return (
            <div
              key={wsId}
              onClick={() => setActiveWorkspace(wsId)}
              className={cn(
                'group flex h-10 cursor-pointer items-center gap-2 border-r border-border px-3 text-sm transition',
                isActive
                  ? 'bg-bg text-text border-b-2 border-b-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text'
              )}
            >
              <span className="max-w-[120px] truncate">{ws?.name ?? 'Workspace'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(wsId) }}
                className="hidden rounded p-0.5 hover:bg-bg-active group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
