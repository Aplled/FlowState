import { useEffect, useRef } from 'react'
import {
  CheckSquare,
  StickyNote,
  FileText,
  Table,
  CalendarDays,
  Globe,
  Pencil,
  ExternalLink,
  Group,
} from 'lucide-react'
import type { NodeType } from '@/types/database'

const NODE_OPTIONS: { type: NodeType; label: string; icon: typeof CheckSquare; color: string }[] = [
  { type: 'task', label: 'Task', icon: CheckSquare, color: 'var(--color-node-task)' },
  { type: 'note', label: 'Note', icon: StickyNote, color: 'var(--color-node-note)' },
  { type: 'doc', label: 'Document', icon: FileText, color: 'var(--color-node-doc)' },
  { type: 'table', label: 'Table', icon: Table, color: 'var(--color-node-table)' },
  { type: 'event', label: 'Event', icon: CalendarDays, color: 'var(--color-node-event)' },
  { type: 'browser', label: 'Browser', icon: Globe, color: 'var(--color-node-browser)' },
  { type: 'draw', label: 'Draw', icon: Pencil, color: 'var(--color-node-draw)' },
  { type: 'tab', label: 'Tab Portal', icon: ExternalLink, color: 'var(--color-node-tab)' },
  { type: 'grouple', label: 'Group', icon: Group, color: 'var(--color-node-grouple)' },
]

interface Props {
  x: number
  y: number
  onAddNode: (type: NodeType) => void
  onClose: () => void
}

export function CanvasContextMenu({ x, y, onAddNode, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-lg border border-border bg-surface py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      <p className="px-3 py-1.5 text-xs font-medium text-text-muted">Add Node</p>
      {NODE_OPTIONS.map(({ type, label, icon: Icon, color }) => (
        <button
          key={type}
          onClick={() => onAddNode(type)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-hover hover:text-text"
        >
          <Icon className="h-4 w-4" style={{ color }} />
          {label}
        </button>
      ))}
    </div>
  )
}
