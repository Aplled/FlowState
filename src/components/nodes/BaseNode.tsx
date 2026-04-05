import { memo, useCallback, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GripVertical, Maximize2, Lock, Trash2 } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useTabStore } from '@/stores/tab-store'
import type { FlowNode } from '@/types/database'

interface BaseNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  color: string
  icon: ReactNode
  title: string
  children: ReactNode
  className?: string
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const BaseNode = memo(function BaseNode({
  node,
  selected,
  color,
  connectTarget,
  icon,
  title,
  children,
  className,
  onDragStart,
  onSelect,
}: BaseNodeProps) {
  const deleteNode = useNodeStore((s) => s.deleteNode)
  const updateNode = useNodeStore((s) => s.updateNode)
  const openExpandedNode = useTabStore((s) => s.openExpandedNode)
  const parentGroup = useNodeStore((s) => {
    if (!node.parent_id) return null
    // Walk up to find the grouple ancestor
    let cur = s.nodes.find((n) => n.id === node.parent_id)
    while (cur) {
      if (cur.type === 'grouple') return cur
      if (!cur.parent_id) break
      cur = s.nodes.find((n) => n.id === cur!.parent_id)
    }
    return null
  })
  const resizing = useRef(false)

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startY = e.clientY
    const startW = node.width
    const startH = node.height

    const onMove = (me: MouseEvent) => {
      if (!resizing.current) return
      const newW = Math.max(140, startW + (me.clientX - startX))
      const newH = Math.max(70, startH + (me.clientY - startY))
      updateNode(node.id, { width: newW, height: newH })
    }

    const onUp = () => {
      resizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [node.id, node.width, node.height, updateNode])

  return (
    <div
      className={cn(
        'group absolute rounded-lg border bg-surface shadow-lg transition-shadow cursor-default',
        connectTarget ? 'shadow-xl ring-2 ring-accent/60' : selected ? 'shadow-xl ring-2' : 'hover:shadow-xl',
        className,
      )}
      style={{
        left: node.position_x,
        top: node.position_y,
        width: node.width,
        height: node.height,
        borderColor: selected ? color : 'var(--color-border)',
        ['--tw-ring-color' as string]: color,
        zIndex: selected ? 999 : node.z_index,
      }}
      onMouseDown={(e) => onSelect(e, node.id)}
    >
      {/* Group membership indicator */}
      {parentGroup && (
        <div
          className="absolute top-0 left-2 right-2 h-[2px] rounded-b"
          style={{ background: (parentGroup.data as any)?.color || '#8b5cf6' }}
        />
      )}

      {/* Connection handles */}
      <div
        className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-bg-secondary opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition cursor-crosshair z-10"
        style={{ borderColor: color }}
        data-handle="top"
        data-node-id={node.id}
      />
      <div
        className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-bg-secondary opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition cursor-crosshair z-10"
        style={{ borderColor: color }}
        data-handle="bottom"
        data-node-id={node.id}
      />
      <div
        className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-bg-secondary opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition cursor-crosshair z-10"
        style={{ borderColor: color }}
        data-handle="left"
        data-node-id={node.id}
      />
      <div
        className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-bg-secondary opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition cursor-crosshair z-10"
        style={{ borderColor: color }}
        data-handle="right"
        data-node-id={node.id}
      />

      {/* Header — drag handle */}
      <div
        className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 cursor-grab active:cursor-grabbing"
        style={{ borderBottomColor: `${color}30` }}
        onMouseDown={(e) => {
          if (e.button !== 0) return
          if (node.is_locked) return
          onDragStart(e, node.id, node.position_x, node.position_y)
        }}
      >
        <GripVertical className="h-3.5 w-3.5 text-text-muted pointer-events-none" />
        <span style={{ color }} className="pointer-events-none">{icon}</span>
        <span className="flex-1 truncate text-xs font-medium text-text pointer-events-none">{title}</span>

        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); openExpandedNode(node.id, title) }}
            className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text cursor-pointer"
            title="Expand"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); updateNode(node.id, { is_locked: !node.is_locked }) }}
            className={cn('rounded p-0.5 hover:bg-bg-hover cursor-pointer', node.is_locked ? 'text-accent' : 'text-text-muted hover:text-text')}
            title={node.is_locked ? 'Unlock' : 'Lock'}
          >
            <Lock className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}
            className="rounded p-0.5 text-text-muted hover:bg-danger/20 hover:text-danger cursor-pointer"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body — fully interactive, no drag interference */}
      <div
        className="px-2 py-2 cursor-default overflow-auto"
        style={{ height: node.height - 34 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-60 transition"
        onMouseDown={onResizeStart}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full text-text-muted">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" opacity="0.4" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.6" />
        </svg>
      </div>
    </div>
  )
})
