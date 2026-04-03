import { memo, type ReactNode } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import {
  GripVertical,
  Maximize2,
  Lock,
  Trash2,
} from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'

interface BaseNodeProps {
  nodeProps: NodeProps
  color: string
  icon: ReactNode
  title: string
  children: ReactNode
  className?: string
}

export const BaseNode = memo(function BaseNode({
  nodeProps,
  color,
  icon,
  title,
  children,
  className,
}: BaseNodeProps) {
  const { id, selected } = nodeProps
  const deleteNode = useNodeStore((s) => s.deleteNode)
  const updateNode = useNodeStore((s) => s.updateNode)
  const dbNode = useNodeStore((s) => s.dbNodes.find((n) => n.id === id))

  return (
    <div
      className={cn(
        'group rounded-lg border bg-surface shadow-lg transition-shadow',
        selected ? 'shadow-xl ring-2' : 'hover:shadow-xl',
        className
      )}
      style={{
        borderColor: selected ? color : 'var(--color-border)',
        ['--tw-ring-color' as string]: color,
        minWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !border-2 !bg-bg-secondary" style={{ borderColor: color }} />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !border-2 !bg-bg-secondary" style={{ borderColor: color }} />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !bg-bg-secondary" style={{ borderColor: color }} />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !bg-bg-secondary" style={{ borderColor: color }} />

      {/* Header */}
      <div
        className="flex items-center gap-2 border-b border-border px-3 py-2"
        style={{ borderBottomColor: `${color}30` }}
      >
        <GripVertical className="h-3.5 w-3.5 cursor-grab text-text-muted" />
        <span style={{ color }}>{icon}</span>
        <span className="flex-1 truncate text-xs font-medium text-text">{title}</span>

        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={() => updateNode(id, { is_expanded: !dbNode?.is_expanded })}
            className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => updateNode(id, { is_locked: !dbNode?.is_locked })}
            className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text"
          >
            <Lock className="h-3 w-3" />
          </button>
          <button
            onClick={() => deleteNode(id)}
            className="rounded p-0.5 text-text-muted hover:bg-danger/20 hover:text-danger"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {children}
      </div>
    </div>
  )
})
