import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, AlertTriangle } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useNodeStore } from '@/stores/node-store'
import { useLayoutStore } from '@/stores/layout-store'
import { sanitizeHtml } from '@/lib/sanitize'
import type { FlowNode, TaskData } from '@/types/database'

interface TaskNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'var(--color-text-muted)',
  in_progress: 'var(--color-warning)',
  done: 'var(--color-success)',
}

const PRIORITIES: TaskData['priority'][] = ['none', 'low', 'medium', 'high', 'urgent']

export const TaskNode = memo(function TaskNode({ node, selected, connectTarget, onDragStart, onSelect }: TaskNodeProps) {
  const data = node.data as unknown as TaskData
  const updateNode = useNodeStore((s) => s.updateNode)
  const compact = useLayoutStore((s) => s.compactNodeHeaders)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(data.title)
  const [descEditing, setDescEditing] = useState(false)
  const descRef = useRef<HTMLDivElement>(null)

  // Sanitize on read so pre-existing DB rows with stored XSS payloads get
  // cleaned before they hit the DOM. Memo on the raw string keeps the diff
  // stable across re-renders that don't touch the description.
  const safeDescription = useMemo(() => sanitizeHtml(data.description), [data.description])

  useEffect(() => {
    if (descEditing && descRef.current) {
      // Populate the contentEditable with the sanitized HTML too — never
      // hand raw data.description to innerHTML, even momentarily.
      descRef.current.innerHTML = sanitizeHtml(data.description)
      descRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(descRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    // Only refresh the editor contents when toggling in/out of edit mode.
    // Including data.description here would clobber the user's active edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descEditing])

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
      connectTarget={connectTarget}
      color="var(--color-warning)"
      icon={<CheckSquare className="h-3.5 w-3.5" />}
      title={data.title}
      titleInput={
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') saveTitle() }}
          className={`w-full bg-transparent text-xs font-medium outline-none cursor-text ${data.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}
        />
      }
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2 text-xs">
        {!compact && (editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full bg-bg-tertiary rounded-xl px-2.5 py-1.5 text-text outline-none ring-1 ring-border focus:ring-accent transition-shadow"
          />
        ) : (
          <p className={`text-text cursor-text leading-relaxed ${data.status === 'done' ? 'line-through text-text-muted' : ''}`} onClick={() => setEditing(true)}>
            {data.title}
          </p>
        ))}

        {descEditing ? (
          <div
            ref={descRef}
            className="text-text-secondary text-[11px] cursor-text min-h-[2em] rounded-lg px-1.5 py-1 bg-bg-tertiary/50 outline-none leading-relaxed my-2"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              // Sanitize on write so anything the user (or a paste-in
              // clipboard payload) introduced gets stripped before it
              // lands in the store + DB.
              const html = sanitizeHtml((e.currentTarget as HTMLElement).innerHTML)
              setDescEditing(false)
              if (html !== (data.description || '')) patchData({ description: html })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).blur() }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="text-text-secondary text-[11px] min-h-[2em] rounded-lg px-1.5 py-1 hover:bg-bg-tertiary/50 transition-colors empty:before:content-[attr(data-placeholder)] empty:before:text-text-muted/50 leading-relaxed my-2"
            data-placeholder="Add a description..."
            onDoubleClick={(e) => { e.stopPropagation(); setDescEditing(true) }}
            dangerouslySetInnerHTML={{ __html: safeDescription }}
          />
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/40">
          <Select
            value={data.status}
            onChange={(v) => patchData({ status: v as TaskData['status'] })}
            options={[
              { value: 'todo', label: 'Todo', color: STATUS_COLORS.todo },
              { value: 'in_progress', label: 'In Progress', color: STATUS_COLORS.in_progress },
              { value: 'done', label: 'Done', color: STATUS_COLORS.done },
            ]}
          />

          <Select
            value={data.priority}
            onChange={(v) => patchData({ priority: v as TaskData['priority'] })}
            options={PRIORITIES.map((p) => ({
              value: p,
              label: p === 'none' ? 'No priority' : p.charAt(0).toUpperCase() + p.slice(1),
            }))}
          />

          <DatePicker
            value={data.due_date}
            onChange={(v) => patchData({ due_date: v })}
          />
          {isOverdue && (
            <span className="flex items-center gap-1 text-danger text-[11px]">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
        </div>

        {/* Tags are internal metadata used for categorization — not displayed */}
      </div>
    </BaseNode>
  )
})
