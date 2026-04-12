import { useMemo, useState, useCallback } from 'react'
import { useNodeStore } from '@/stores/node-store'
import { useTabStore } from '@/stores/tab-store'
import { CheckSquare, Circle, Clock, AlertTriangle } from 'lucide-react'
import type { TaskData, FlowNode } from '@/types/database'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { id: 'todo' as const, label: 'To Do', color: '#94a3b8', Icon: Circle },
  { id: 'in_progress' as const, label: 'In Progress', color: '#f59e0b', Icon: Clock },
  { id: 'done' as const, label: 'Done', color: '#22c55e', Icon: CheckSquare },
]

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  none: '#64748b',
}

export function KanbanView() {
  const allNodes = useNodeStore((s) => s.allNodes)
  const updateNode = useNodeStore((s) => s.updateNode)
  const openExpandedNode = useTabStore((s) => s.openExpandedNode)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const tasks = useMemo(() => {
    return allNodes
      .filter((n) => n.type === 'task')
      .map((n) => ({ node: n, data: n.data as unknown as TaskData }))
  }, [allNodes])

  const columns = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      tasks: tasks
        .filter(({ data }) => data.status === col.id)
        .sort((a, b) => {
          const priOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
          return priOrder[a.data.priority] - priOrder[b.data.priority]
        }),
    }))
  }, [tasks])

  const onDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggedId(nodeId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverCol(colId)
  }, [])

  const onDrop = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggedId) return
    const task = tasks.find((t) => t.node.id === draggedId)
    if (task && task.data.status !== colId) {
      updateNode(draggedId, { data: { ...task.data, status: colId } as unknown as FlowNode['data'] })
    }
    setDraggedId(null)
  }, [draggedId, tasks, updateNode])

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-text">Board</h1>
        <span className="text-xs text-text-muted">{tasks.length} tasks</span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn(
                'flex flex-col w-72 rounded-xl border transition-colors',
                dragOverCol === col.id ? 'border-accent bg-accent/5' : 'border-border/50 bg-bg-secondary/50',
              )}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
                <col.Icon className="h-3.5 w-3.5" style={{ color: col.color }} />
                <span className="text-xs font-semibold text-text">{col.label}</span>
                <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                  {col.tasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {col.tasks.map(({ node, data }) => {
                  const isOverdue = data.due_date && new Date(data.due_date) < new Date() && data.status !== 'done'
                  return (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, node.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => openExpandedNode(node.id, data.title)}
                      className={cn(
                        'rounded-lg border border-border/50 bg-surface p-3 cursor-pointer hover:shadow-md transition-all group',
                        draggedId === node.id && 'opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm text-text leading-snug',
                            data.status === 'done' && 'line-through text-text-muted',
                          )}>
                            {data.title}
                          </p>
                          {data.description && (
                            <p className="text-xs text-text-muted mt-1 line-clamp-2">{data.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {data.priority !== 'none' && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ color: PRIORITY_COLORS[data.priority], background: PRIORITY_COLORS[data.priority] + '18' }}
                          >
                            {data.priority.charAt(0).toUpperCase() + data.priority.slice(1)}
                          </span>
                        )}
                        {data.due_date && (
                          <span className={cn('text-[10px] flex items-center gap-0.5', isOverdue ? 'text-danger' : 'text-text-muted')}>
                            {isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
                            {new Date(data.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {data.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-accent bg-accent-muted px-1.5 py-0.5 rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
