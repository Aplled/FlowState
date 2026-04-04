import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import type { FlowNode, TabData } from '@/types/database'

export function TabNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as TabData
  const workspaces = useFolderStore((s) => s.workspaces)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspace = useTabStore((s) => s.openWorkspace)
  const targetWs = workspaces.find((w) => w.id === data.target_workspace_id)

  const handleOpen = () => {
    if (data.target_workspace_id) {
      setActiveWorkspace(data.target_workspace_id)
      openWorkspace(data.target_workspace_id, data.label || targetWs?.name || 'Workspace')
    }
  }

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-xl font-bold text-text">{data.label || 'Embed Workspace'}</h2>

      {targetWs ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-text-muted font-medium">Linked Workspace</label>
            <p className="text-sm text-text">{targetWs.name}</p>
          </div>
          <button
            onClick={handleOpen}
            className="px-4 py-2 rounded bg-accent/20 text-accent hover:bg-accent/30 text-sm cursor-pointer transition"
          >
            Open Workspace →
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-muted">No workspace linked to this node.</p>
      )}
    </div>
  )
}
