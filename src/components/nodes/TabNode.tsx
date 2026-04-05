import { memo } from 'react'
import { Layers } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import type { FlowNode, TabData } from '@/types/database'

interface TabNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const TabNode = memo(function TabNode({ node, selected, connectTarget, onDragStart, onSelect }: TabNodeProps) {
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
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#64748b"
      icon={<Layers className="h-3.5 w-3.5" />}
      title={data.label || 'Embed Workspace'}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        <button
          onClick={handleOpen}
          className="w-full text-left text-xs text-text-secondary hover:text-accent transition cursor-pointer"
        >
          {targetWs ? `Open "${targetWs.name}"` : data.label || 'No workspace linked'} →
        </button>
        {targetWs && (
          <div className="text-[10px] text-text-muted">
            Workspace: {targetWs.name}
          </div>
        )}
      </div>
    </BaseNode>
  )
})
