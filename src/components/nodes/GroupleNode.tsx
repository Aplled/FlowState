import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Group } from 'lucide-react'
import type { GroupleData } from '@/types/database'

export const GroupleNode = memo(function GroupleNode(props: NodeProps) {
  const data = props.data as unknown as GroupleData & { _dbNode: unknown }

  return (
    <BaseNode
      nodeProps={props}
      color={data.color || 'var(--color-node-grouple)'}
      icon={<Group className="h-3.5 w-3.5" />}
      title={data.label || 'Group'}
    >
      <div className="min-h-[100px] rounded-md border border-dashed border-border-light p-2 text-center text-xs text-text-muted">
        Drop nodes here to group them
      </div>
    </BaseNode>
  )
})
