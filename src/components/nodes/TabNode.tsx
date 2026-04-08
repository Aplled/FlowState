import { memo, useState, useCallback, useRef } from 'react'
import { Layers, GripVertical, Maximize2, Lock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, TabData } from '@/types/database'

const COLOR_OPTIONS = ['#64748b', '#6366f1', '#f59e0b', '#22c55e', '#3b82f6', '#f472b6', '#ef4444', '#14b8a6']

interface TabNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const TabNode = memo(function TabNode({ node, selected, connectTarget, onDragStart, onSelect }: TabNodeProps) {
  const data = node.data as unknown as TabData
  const updateNode = useNodeStore((s) => s.updateNode)
  const deleteNode = useNodeStore((s) => s.deleteNode)
  const openExpandedNode = useTabStore((s) => s.openExpandedNode)
  const workspaces = useFolderStore((s) => s.workspaces)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspace = useTabStore((s) => s.openWorkspace)
  const updateWorkspace = useFolderStore((s) => s.updateWorkspace)
  const targetWs = workspaces.find((w) => w.id === data.target_workspace_id)
  const color = data.color || '#64748b'
  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(data.label || targetWs?.name || '')
  const resizing = useRef(false)

  const patchData = (patch: Partial<TabData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const saveLabel = () => {
    setEditingLabel(false)
    if (label !== data.label) {
      patchData({ label })
      if (targetWs && label !== targetWs.name) {
        updateWorkspace(targetWs.id, { name: label })
      }
    }
  }

  const handleOpen = () => {
    if (data.target_workspace_id) {
      setActiveWorkspace(data.target_workspace_id)
      openWorkspace(data.target_workspace_id, data.label || targetWs?.name || 'Workspace')
    }
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
      updateNode(node.id, { width: Math.max(140, startW + (me.clientX - startX)), height: Math.max(70, startH + (me.clientY - startY)) })
    }
    const onUp = () => {
      resizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [node.id, node.width, node.height, updateNode])

  const title = data.label || 'Embed Workspace'

  return (
    <div
      className={cn(
        'group absolute rounded-lg border bg-surface shadow-lg transition-shadow cursor-default',
        connectTarget ? 'shadow-xl ring-2 ring-accent/60' : selected ? 'shadow-xl ring-2' : 'hover:shadow-xl',
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
      {/* Connection handles */}
      {['top', 'bottom', 'left', 'right'].map((pos) => (
        <div
          key={pos}
          className={cn(
            'absolute w-2.5 h-2.5 rounded-full border-2 bg-bg-secondary opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition cursor-crosshair z-10',
            pos === 'top' && '-top-[5px] left-1/2 -translate-x-1/2',
            pos === 'bottom' && '-bottom-[5px] left-1/2 -translate-x-1/2',
            pos === 'left' && '-left-[5px] top-1/2 -translate-y-1/2',
            pos === 'right' && '-right-[5px] top-1/2 -translate-y-1/2',
          )}
          style={{ borderColor: color }}
          data-handle={pos}
          data-node-id={node.id}
        />
      ))}

      {/* Header */}
      <div
        className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 cursor-grab active:cursor-grabbing"
        style={{ borderBottomColor: `${color}30` }}
        onMouseDown={(e) => {
          if (e.button !== 0 || node.is_locked) return
          onDragStart(e, node.id, node.position_x, node.position_y)
        }}
      >
        <GripVertical className="h-3.5 w-3.5 text-text-muted pointer-events-none" />
        <span style={{ color }} className="pointer-events-none"><Layers className="h-3.5 w-3.5" /></span>
        <span className="flex-1 truncate text-xs font-medium text-text pointer-events-none">{title}</span>
        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); openExpandedNode(node.id, title) }}
            className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text cursor-pointer"
          ><Maximize2 className="h-3 w-3" /></button>
          <button
            onClick={(e) => { e.stopPropagation(); updateNode(node.id, { is_locked: !node.is_locked }) }}
            className={cn('rounded p-0.5 hover:bg-bg-hover cursor-pointer', node.is_locked ? 'text-accent' : 'text-text-muted hover:text-text')}
          ><Lock className="h-3 w-3" /></button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}
            className="rounded p-0.5 text-text-muted hover:bg-danger/20 hover:text-danger cursor-pointer"
          ><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>

      {/* Body */}
      <div className="px-2 py-2 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        {editingLabel ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
            className="w-full bg-transparent text-xs text-text outline-none ring-1 ring-accent rounded px-1 py-0.5 cursor-text"
          />
        ) : (
          <span
            onDoubleClick={() => setEditingLabel(true)}
            className="block text-xs text-text-secondary cursor-text truncate"
          >
            {data.label || targetWs?.name || 'Untitled workspace'}
          </span>
        )}

        <button
          onClick={handleOpen}
          className="w-full text-left text-xs text-accent/80 hover:text-accent transition cursor-pointer"
        >
          {targetWs ? 'Enter →' : 'No workspace linked'}
        </button>

        {selected && (
          <div className="flex items-center gap-1 pt-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); patchData({ color: c }) }}
                className="h-3.5 w-3.5 rounded-full border-2 transition hover:scale-125 cursor-pointer"
                style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
              />
            ))}
          </div>
        )}
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
