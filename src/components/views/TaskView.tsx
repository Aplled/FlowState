import { useMemo, useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import { CheckSquare, Circle, Clock, AlertTriangle, ChevronDown } from 'lucide-react'
import type { TaskData } from '@/types/database'

const STATUS_CONFIG = {
  todo: { label: 'Todo', color: '#94a3b8', icon: Circle },
  in_progress: { label: 'In Progress', color: '#f59e0b', icon: Clock },
  done: { label: 'Done', color: '#22c55e', icon: CheckSquare },
} as const

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low: { label: 'Low', color: '#3b82f6' },
  none: { label: 'None', color: '#64748b' },
} as const

export function TaskView() {
  const allNodes = useNodeStore((s) => s.allNodes)
  const updateNode = useNodeStore((s) => s.updateNode)
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all')

  const tasks = useMemo(() => {
    return allNodes
      .filter((n) => n.type === 'task')
      .map((n) => ({ node: n, data: n.data as unknown as TaskData }))
      .filter(({ data }) => filter === 'all' || data.status === filter)
      .sort((a, b) => {
        // Sort by priority (urgent first), then by due date
        const priOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
        const priDiff = priOrder[a.data.priority] - priOrder[b.data.priority]
        if (priDiff !== 0) return priDiff
        if (a.data.due_date && b.data.due_date) return a.data.due_date.localeCompare(b.data.due_date)
        if (a.data.due_date) return -1
        if (b.data.due_date) return 1
        return 0
      })
  }, [allNodes, filter])

  const toggleStatus = (nodeId: string, currentData: TaskData) => {
    const order: TaskData['status'][] = ['todo', 'in_progress', 'done']
    const idx = order.indexOf(currentData.status)
    const next = order[(idx + 1) % order.length]
    updateNode(nodeId, { data: { ...currentData, status: next } as unknown as typeof allNodes[0]['data'] })
  }

  const counts = useMemo(() => {
    const all = allNodes.filter((n) => n.type === 'task')
    return {
      all: all.length,
      todo: all.filter((n) => (n.data as unknown as TaskData).status === 'todo').length,
      in_progress: all.filter((n) => (n.data as unknown as TaskData).status === 'in_progress').length,
      done: all.filter((n) => (n.data as unknown as TaskData).status === 'done').length,
    }
  }, [allNodes])

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text">All Tasks</h1>
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'todo', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full cursor-pointer transition ${
                filter === f ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-bg-hover'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f].label} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {tasks.length === 0 ? (
          <div className="text-center text-text-muted py-12">
            <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No tasks yet</p>
            <p className="text-xs mt-1">Right-click the canvas to add task nodes</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map(({ node, data }) => {
              const StatusIcon = STATUS_CONFIG[data.status].icon
              const isOverdue = data.due_date && new Date(data.due_date) < new Date() && data.status !== 'done'
              return (
                <div
                  key={node.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition group"
                >
                  <button
                    onClick={() => toggleStatus(node.id, data)}
                    className="shrink-0 cursor-pointer"
                    style={{ color: STATUS_CONFIG[data.status].color }}
                  >
                    <StatusIcon className="h-4 w-4" />
                  </button>
                  <span className={`flex-1 text-sm ${data.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}>
                    {data.title}
                  </span>
                  {data.priority !== 'none' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ color: PRIORITY_CONFIG[data.priority].color, background: PRIORITY_CONFIG[data.priority].color + '20' }}
                    >
                      {PRIORITY_CONFIG[data.priority].label}
                    </span>
                  )}
                  {data.due_date && (
                    <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-danger' : 'text-text-muted'}`}>
                      {isOverdue && <AlertTriangle className="h-3 w-3" />}
                      {new Date(data.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
