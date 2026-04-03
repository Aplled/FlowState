import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FlowNode, TaskData } from '@/types/database'
import { CheckSquare, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusConfig = {
  todo: { label: 'To Do', icon: Circle, color: '#606078' },
  in_progress: { label: 'In Progress', icon: Clock, color: '#3b82f6' },
  done: { label: 'Done', icon: CheckSquare, color: '#22c55e' },
  cancelled: { label: 'Cancelled', icon: Circle, color: '#ef4444' },
}

export function TaskListView() {
  const [tasks, setTasks] = useState<FlowNode[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('type', 'task')
        .order('created_at', { ascending: false })
      if (data) setTasks(data as FlowNode[])
    }
    load()
  }, [])

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-text">All Tasks</h1>
      <div className="space-y-2">
        {tasks.map((node) => {
          const task = node.data as unknown as TaskData
          const status = statusConfig[task.status ?? 'todo']
          const StatusIcon = status.icon
          return (
            <div
              key={node.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:bg-surface-hover"
            >
              <StatusIcon className="h-4 w-4 shrink-0" style={{ color: status.color }} />
              <span className={cn('flex-1 text-sm', task.status === 'done' && 'line-through text-text-muted')}>
                {task.title}
              </span>
              {task.due_date && (
                <span className="text-xs text-text-muted">
                  {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
              {task.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent">
                  {tag}
                </span>
              ))}
            </div>
          )
        })}
        {tasks.length === 0 && (
          <p className="py-12 text-center text-sm text-text-muted">No tasks yet. Create task nodes on the canvas.</p>
        )}
      </div>
    </div>
  )
}
