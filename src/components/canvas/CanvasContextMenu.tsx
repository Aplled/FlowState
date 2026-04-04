import { useEffect, useRef } from 'react'
import {
  CheckSquare,
  StickyNote,
  FileText,
  Table,
  Calendar,
  Globe,
  Pencil,
  FolderOpen,
  Group,
} from 'lucide-react'
import type { NodeType } from '@/types/database'

interface CanvasContextMenuProps {
  x: number
  y: number
  onAddNode: (type: NodeType) => void
  onClose: () => void
}

const items: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'task', label: 'Task', icon: <CheckSquare className="h-4 w-4" />, color: '#f59e0b' },
  { type: 'note', label: 'Note', icon: <StickyNote className="h-4 w-4" />, color: '#a78bfa' },
  { type: 'doc', label: 'Document', icon: <FileText className="h-4 w-4" />, color: '#3b82f6' },
  { type: 'table', label: 'Table', icon: <Table className="h-4 w-4" />, color: '#14b8a6' },
  { type: 'event', label: 'Event', icon: <Calendar className="h-4 w-4" />, color: '#f472b6' },
  { type: 'browser', label: 'Browser', icon: <Globe className="h-4 w-4" />, color: '#6366f1' },
  { type: 'draw', label: 'Draw', icon: <Pencil className="h-4 w-4" />, color: '#22c55e' },
  { type: 'tab', label: 'Embed Workspace', icon: <FolderOpen className="h-4 w-4" />, color: '#64748b' },
  { type: 'grouple', label: 'Group', icon: <Group className="h-4 w-4" />, color: '#8b5cf6' },
]

export function CanvasContextMenu({ x, y, onAddNode, onClose }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Add Node
      </div>
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddNode(item.type)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
        >
          <span style={{ color: item.color }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
