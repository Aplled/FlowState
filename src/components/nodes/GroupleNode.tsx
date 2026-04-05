import { memo, useCallback, useRef, useState } from 'react'
import { Group } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, GroupleData } from '@/types/database'

const COLOR_OPTIONS = ['#6366f1', '#f59e0b', '#22c55e', '#3b82f6', '#f472b6', '#ef4444', '#14b8a6', '#a78bfa']

interface GroupleNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const GroupleNode = memo(function GroupleNode({ node, selected, onDragStart, onSelect }: GroupleNodeProps) {
  const data = node.data as unknown as GroupleData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(data.label || '')
  const resizing = useRef(false)

  const color = data.color || '#6366f1'

  const patchData = (patch: Partial<GroupleData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const saveLabel = () => {
    setEditingLabel(false)
    if (label !== data.label) patchData({ label })
  }

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
      updateNode(node.id, {
        width: Math.max(200, startW + (me.clientX - startX)),
        height: Math.max(150, startH + (me.clientY - startY)),
      })
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
      className="absolute rounded-xl group"
      style={{
        left: node.position_x,
        top: node.position_y,
        width: node.width,
        height: node.height,
        background: `${color}08`,
        border: `2px ${selected ? 'solid' : 'dashed'} ${color}${selected ? '' : '40'}`,
        borderRadius: 12,
        zIndex: selected ? 998 : Math.max(0, node.z_index - 1),
      }}
      onMouseDown={(e) => onSelect(e, node.id)}
    >
      {/* Header - drag handle */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          if (e.button !== 0) return
          if (node.is_locked) return
          onDragStart(e, node.id, node.position_x, node.position_y)
        }}
      >
        <Group className="h-3.5 w-3.5 pointer-events-none" style={{ color }} />
        {editingLabel ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-transparent text-xs font-medium text-text outline-none ring-1 ring-accent rounded px-1 cursor-text"
          />
        ) : (
          <span
            onDoubleClick={() => setEditingLabel(true)}
            className="text-xs font-medium cursor-text"
            style={{ color }}
          >
            {data.label || 'Group'}
          </span>
        )}

        {selected && (
          <div className="ml-auto flex items-center gap-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); patchData({ color: c }) }}
                className="h-3.5 w-3.5 rounded-full border border-border transition hover:scale-125 cursor-pointer"
                style={{ background: c, borderColor: c === color ? '#fff' : undefined }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-60 transition"
        onMouseDown={onResizeStart}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full" style={{ color }}>
          <path d="M14 14L8 14L14 8Z" fill="currentColor" opacity="0.4" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.6" />
        </svg>
      </div>
    </div>
  )
})
