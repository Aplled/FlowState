import { memo, useState } from 'react'
import { CheckSquare, AlertTriangle } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, TaskData } from '@/types/database'

interface TaskNodeProps {
  node: FlowNode
  selected: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#f59e0b',
  done: '#22c55e',
}

const PRIORITIES: TaskData['priority'][] = ['none', 'low', 'medium', 'high', 'urgent']

export const TaskNode = memo(function TaskNode({ node, selected, onDragStart, onSelect }: TaskNodeProps) {
  const data = node.data as unknown as TaskData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(data.title)

  const patchData = (patch: Partial<TaskData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const saveTitle = () => {
    setEditing(false)
    if (title !== data.title) patchData({ title })
  }

  const isOverdue = data.due_date && new Date(data.due_date) < new Date() && data.status !== 'done'

  return (
    <BaseNode
      node={node}
      selected={selected}
      color="#f59e0b"
      icon={<CheckSquare className="h-3.5 w-3.5" />}
      title={data.title}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2 text-xs">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full bg-bg-tertiary rounded px-2 py-1 text-text outline-none ring-1 ring-border focus:ring-accent"
          />
        ) : (
          <p className={`text-text cursor-text ${data.status === 'done' ? 'line-through text-text-muted' : ''}`} onDoubleClick={() => setEditing(true)}>
            {data.title}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={data.status}
            onChange={(e) => patchData({ status: e.target.value as TaskData['status'] })}
            className="bg-bg-tertiary rounded px-1.5 py-0.5 text-text-secondary outline-none cursor-pointer"
            style={{ color: STATUS_COLORS[data.status] }}
          >
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          <select
            value={data.priority}
            onChange={(e) => patchData({ priority: e.target.value as TaskData['priority'] })}
            className="bg-bg-tertiary rounded px-1.5 py-0.5 text-text-secondary outline-none cursor-pointer"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p === 'none' ? 'No priority' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={data.due_date?.slice(0, 10) ?? ''}
            onChange={(e) => patchData({ due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className="bg-bg-tertiary rounded px-1.5 py-0.5 text-text-secondary outline-none cursor-pointer text-[11px]"
          />
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-danger">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
        </div>

        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] text-accent">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  )
})
