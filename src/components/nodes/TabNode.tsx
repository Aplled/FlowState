import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { ExternalLink } from 'lucide-react'
import { useFolderStore } from '@/stores/folder-store'
import type { TabNodeData } from '@/types/database'

export const TabNode = memo(function TabNode(props: NodeProps) {
  const data = props.data as unknown as TabNodeData & { _dbNode: unknown }
  const { workspaces, setActiveWorkspace } = useFolderStore()
  const target = workspaces.find((w) => w.id === data.target_workspace_id)

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-tab)"
      icon={<ExternalLink className="h-3.5 w-3.5" />}
      title="Tab Portal"
    >
      <button
        onClick={() => data.target_workspace_id && setActiveWorkspace(data.target_workspace_id)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent"
      >
        <ExternalLink className="h-4 w-4" />
        {target ? target.name : data.label || 'Link to workspace...'}
      </button>
    </BaseNode>
  )
})
