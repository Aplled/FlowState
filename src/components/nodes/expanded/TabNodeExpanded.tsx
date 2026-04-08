import { useState } from 'react'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, TabData } from '@/types/database'

const COLOR_OPTIONS = ['#64748b', '#6366f1', '#f59e0b', '#22c55e', '#3b82f6', '#f472b6', '#ef4444', '#14b8a6']

export function TabNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as TabData
  const updateNode = useNodeStore((s) => s.updateNode)
  const workspaces = useFolderStore((s) => s.workspaces)
  const updateWorkspace = useFolderStore((s) => s.updateWorkspace)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspace = useTabStore((s) => s.openWorkspace)
  const targetWs = workspaces.find((w) => w.id === data.target_workspace_id)
  const [label, setLabel] = useState(data.label || targetWs?.name || '')

  const patchData = (patch: Partial<TabData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const handleRename = () => {
    if (label !== data.label) {
      patchData({ label })
      if (targetWs && label !== targetWs.name) {
        updateWorkspace(targetWs.id, { name: label })
      }
    }
  }

  const handleOpen = () => {
    if (data.target_workspace_id) {
      setActiveWorkspace(data.target_workspace_id)
      openWorkspace(data.target_workspace_id, data.label || targetWs?.name || 'Workspace')
    }
  }

  return (
    <div className="p-6 space-y-5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={handleRename}
        onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
        className="w-full text-xl font-bold bg-transparent text-text outline-none"
        placeholder="Workspace name"
      />

      <div className="space-y-2">
        <label className="text-[10px] uppercase text-text-muted font-medium">Color</label>
        <div className="flex items-center gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => patchData({ color: c })}
              className="h-6 w-6 rounded-full border-2 cursor-pointer transition hover:scale-110"
              style={{ background: c, borderColor: c === (data.color || '#64748b') ? '#fff' : 'transparent' }}
            />
          ))}
        </div>
      </div>

      {targetWs ? (
        <button
          onClick={handleOpen}
          className="w-full px-4 py-3 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-sm cursor-pointer transition text-center"
        >
          Enter "{targetWs.name}" →
        </button>
      ) : (
        <p className="text-sm text-text-muted">No workspace linked to this node.</p>
      )}
    </div>
  )
}
