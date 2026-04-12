import { memo, useState } from 'react'
import { ChevronRight, ChevronDown, Group } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, GroupleData } from '@/types/database'

const COLOR_OPTIONS = ['#8b6f4e', '#b8860b', '#5a7c5a', '#5b7fa5', '#9a7eb0', '#a0522d', '#7a9ab0', '#9c8e7c']

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
  const childCount = useNodeStore((s) => s.nodes.filter((n) => n.parent_id === node.id).length)
  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(data.label || '')

  const color = data.color || '#8b6f4e'
  const collapsed = data.collapsed ?? false

  const patchData = (patch: Partial<GroupleData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const saveLabel = () => {
    setEditingLabel(false)
    if (label !== data.label) patchData({ label })
  }

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    patchData({ collapsed: !collapsed })
  }

  return (
    <div
      className="absolute rounded-2xl"
      style={{
        left: node.position_x,
        top: node.position_y,
        width: node.width,
        minHeight: node.height,
        zIndex: node.z_index,
      }}
      onMouseDown={(e) => onSelect(e, node.id)}
    >
      <div
        className="rounded-2xl border-2 transition-colors"
        style={{
          background: `color-mix(in srgb, ${color} 6%, var(--color-surface))`,
          borderColor: selected ? color : `${color}30`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            if (e.button !== 0 || node.is_locked) return
            onDragStart(e, node.id, node.position_x, node.position_y)
          }}
        >
          <button
            onClick={toggleCollapse}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-shrink-0 p-0.5 rounded-lg hover:bg-bg-hover/60 transition cursor-pointer"
            style={{ color }}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />
            }
          </button>

          <Group className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />

          {editingLabel ? (
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={saveLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-transparent text-sm font-medium text-text outline-none ring-1 ring-accent rounded-lg px-1.5 flex-1 min-w-0 cursor-text"
            />
          ) : (
            <span
              onDoubleClick={() => setEditingLabel(true)}
              className="text-sm font-medium truncate cursor-text flex-1 min-w-0"
              style={{ color }}
            >
              {data.label || 'Group'}
            </span>
          )}

          <span className="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
            {childCount}
          </span>

          {/* Connection handle */}
          <div
            data-handle="true"
            data-node-id={node.id}
            className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 cursor-crosshair hover:scale-150 transition"
            style={{ borderColor: color, background: 'transparent' }}
          />
        </div>

        {/* Color picker when selected */}
        {selected && (
          <div className="flex items-center gap-1.5 px-3 pb-2.5" onMouseDown={(e) => e.stopPropagation()}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); patchData({ color: c }) }}
                className="h-3.5 w-3.5 rounded-full border-2 transition hover:scale-125 cursor-pointer"
                style={{ background: c, borderColor: c === color ? 'var(--color-text)' : 'transparent' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
