import { memo, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { CheckSquare, Circle, Clock, AlertTriangle, Flag } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { cn } from '@/lib/utils'
import type { TaskData, Priority } from '@/types/database'

const priorityConfig: Record<Priority, { color: string; icon: typeof Flag }> = {
  none: { color: '#606078', icon: Flag },
  low: { color: '#3b82f6', icon: Flag },
  medium: { color: '#f59e0b', icon: Flag },
  high: { color: '#f97316', icon: Flag },
  urgent: { color: '#ef4444', icon: AlertTriangle },
}

const statusConfig = {
  todo: { label: 'To Do', icon: Circle, color: '#606078' },
  in_progress: { label: 'In Progress', icon: Clock, color: '#3b82f6' },
  done: { label: 'Done', icon: CheckSquare, color: '#22c55e' },
  cancelled: { label: 'Cancelled', icon: Circle, color: '#ef4444' },
}

export const TaskNode = memo(function TaskNode(props: NodeProps) {
  const data = props.data as unknown as TaskData & { _dbNode: unknown }
  const updateNode = useNodeStore((s) => s.updateNode)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(data.title)

  const status = statusConfig[data.status ?? 'todo']
  const priority = priorityConfig[data.priority ?? 'none']
  const StatusIcon = status.icon
  const PriorityIcon = priority.icon

  const cycleStatus = () => {
    const order: ('todo' | 'in_progress' | 'done')[] = ['todo', 'in_progress', 'done']
    const idx = order.indexOf(data.status === 'cancelled' ? 'todo' : (data.status ?? 'todo'))
    const next = order[(idx + 1) % order.length]
    updateNode(props.id, { data: { ...data, _dbNode: undefined, status: next } })
  }

  const saveTitle = () => {
    setEditing(false)
    if (title !== data.title) {
      updateNode(props.id, { data: { ...data, _dbNode: undefined, title } })
    }
  }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-task)"
      icon={<CheckSquare className="h-3.5 w-3.5" />}
      title="Task"
    >
      <div className="space-y-2">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className="w-full bg-transparent text-sm font-medium text-text outline-none"
          />
        ) : (
          <p
            onDoubleClick={() => setEditing(true)}
            className={cn(
              'text-sm font-medium text-text cursor-text',
              data.status === 'done' && 'line-through text-text-muted'
            )}
          >
            {data.title}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button onClick={cycleStatus} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs" style={{ color: status.color, background: `${status.color}15` }}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </button>
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs" style={{ color: priority.color, background: `${priority.color}15` }}>
            <PriorityIcon className="h-3 w-3" />
          </span>
        </div>

        {data.due_date && (
          <p className="text-xs text-text-muted">Due: {new Date(data.due_date).toLocaleDateString()}</p>
        )}

        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  )
})
