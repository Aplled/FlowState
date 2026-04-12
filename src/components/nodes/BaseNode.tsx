import { memo, useCallback, useRef, useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Maximize2, Lock, Trash2 } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useShallow } from 'zustand/react/shallow'
import { useTabStore } from '@/stores/tab-store'
import { useLayoutStore } from '@/stores/layout-store'
import type { FlowNode } from '@/types/database'

interface BaseNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  color: string
  icon: ReactNode
  title: string
  /** Editable title input rendered in header when compact headers is on */
  titleInput?: ReactNode
  /** Extra elements rendered in the header actions area (visible on hover) */
  headerExtra?: ReactNode
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
  titleInput,
  headerExtra,
  children,
  className,
  onDragStart,
  onSelect,
}: BaseNodeProps) {
  const deleteNode = useNodeStore((s) => s.deleteNode)
  const updateNode = useNodeStore((s) => s.updateNode)
  const openExpandedNode = useTabStore((s) => s.openExpandedNode)
  const compactHeaders = useLayoutStore((s) => s.compactNodeHeaders)
  const groupColors = useNodeStore(useShallow((s) => {
    const colors: string[] = []
    let cur = node.parent_id ? s.nodes.find((n) => n.id === node.parent_id) : null
    while (cur) {
      if (cur.type === 'grouple') {
        colors.push(((cur.data as { color?: string })?.color) || '#8b5cf6')
        break
      }
      cur = cur.parent_id ? s.nodes.find((n) => n.id === cur!.parent_id) : null
    }
    const extras = ((node.data as { extra_group_ids?: string[] })?.extra_group_ids) ?? []
    for (const gid of extras) {
      const g = s.nodes.find((n) => n.id === gid && n.type === 'grouple')
      if (g) colors.push(((g.data as { color?: string })?.color) || '#8b5cf6')
    }
    return colors
  }))
  const [bodyEditing, setBodyEditing] = useState(false)
  const editTarget = useRef<'body' | 'header'>('body')
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerTitleRef = useRef<HTMLDivElement>(null)
  const resizing = useRef(false)

  const startEditing = useCallback((target: 'body' | 'header') => {
    editTarget.current = target
    setBodyEditing(true)
  }, [])

  // Exit edit mode when deselected
  useEffect(() => {
    if (!selected) setBodyEditing(false)
  }, [selected])

  // Exit edit mode when clicking outside this node
  useEffect(() => {
    if (!bodyEditing) return
    const onPointerDown = (e: PointerEvent) => {
      const nodeEl = bodyRef.current?.parentElement
      if (nodeEl && !nodeEl.contains(e.target as Node)) {
        // Blur first so input onBlur/onChange saves the value before we unmount it
        const active = document.activeElement as HTMLElement | null
        if (active && nodeEl.contains(active)) active.blur()
        // Let blur handlers run, then exit edit mode
        requestAnimationFrame(() => setBodyEditing(false))
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [bodyEditing])

  // Focus the correct input when entering edit mode
  useEffect(() => {
    if (!bodyEditing) return
    const id = requestAnimationFrame(() => {
      const container = editTarget.current === 'header' ? headerTitleRef.current : bodyRef.current
      if (!container) return
      const input = container.querySelector('input[type="text"], input:not([type]), textarea, [contenteditable="true"]') as HTMLElement | null
      if (input) {
        (input as HTMLInputElement).focus?.()
        ;(input as HTMLInputElement).select?.()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [bodyEditing])

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
        'group absolute rounded-2xl border bg-surface transition-shadow duration-200 cursor-default',
        !bodyEditing && 'select-none',
        connectTarget
          ? 'shadow-lg ring-2 ring-accent/50'
          : selected
            ? 'shadow-lg ring-2'
            : 'shadow-sm hover:shadow-md',
        className,
      )}
      style={{
        left: node.position_x,
        top: node.position_y,
        width: node.width,
        minHeight: node.height,
        borderColor: selected ? color : 'var(--color-border)',
        ['--tw-ring-color' as string]: color,
        zIndex: selected ? 999 : node.z_index,
      }}
      onMouseDown={(e) => {
        onSelect(e, node.id)
      }}
    >
      {/* Group membership indicator */}
      {groupColors.length > 0 && (
        <div className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full flex overflow-hidden">
          {groupColors.map((c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      )}

      {/* Connection handles */}
      {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
        <div
          key={pos}
          className={cn(
            'absolute w-2.5 h-2.5 rounded-full border-2 bg-surface opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-125 transition-all cursor-crosshair z-10',
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
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing rounded-t-2xl overflow-hidden"
        style={{ borderBottom: `1px solid ${color}18` }}
        onMouseDown={(e) => {
          if (e.button !== 0 || node.is_locked) return
          if (compactHeaders && titleInput && e.detail === 2) return
          if (bodyEditing) setBodyEditing(false)
          onDragStart(e, node.id, node.position_x, node.position_y)
        }}
      >
        <span style={{ color }} className="pointer-events-none shrink-0">{icon}</span>
        {!compactHeaders && <span className="text-xs font-medium text-text pointer-events-none" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0%', minWidth: 0 }}>{title}</span>}
        {compactHeaders && titleInput ? (
          <div
            className="min-w-0" style={{ flex: '1 1 0%', overflow: 'hidden' }}
            ref={headerTitleRef}
            onMouseDown={(e) => {
              if (bodyEditing) {
                const el = e.target as HTMLElement
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
                  e.stopPropagation()
                }
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              startEditing('header')
            }}
          >
            {bodyEditing ? titleInput : <span className="block truncate text-xs font-medium text-text pointer-events-none">{title}</span>}
          </div>
        ) : compactHeaders && <span className="flex-1" />}

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {headerExtra}
          <button
            onClick={(e) => { e.stopPropagation(); openExpandedNode(node.id, title) }}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-hover hover:text-text cursor-pointer transition-colors"
            title="Expand"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); updateNode(node.id, { is_locked: !node.is_locked }) }}
            className={cn('rounded-lg p-1 hover:bg-bg-hover cursor-pointer transition-colors', node.is_locked ? 'text-accent' : 'text-text-muted hover:text-text')}
            title={node.is_locked ? 'Unlock' : 'Lock'}
          >
            <Lock className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}
            className="rounded-lg p-1 text-text-muted hover:bg-danger/15 hover:text-danger cursor-pointer transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body – double-click to edit text, buttons/selects always work */}
      <div
        ref={bodyRef}
        className={cn(
          'px-3 py-2',
          !bodyEditing && 'cursor-grab active:cursor-grabbing select-none',
        )}
        onMouseDown={(e) => {
          if (e.button !== 0 || node.is_locked) return
          const el = e.target as HTMLElement
          const tag = el.tagName
          // Let interactive controls work without starting drag
          if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable || el.closest('button, select, a, input, textarea, [role="button"], [role="menu"], [role="menuitem"], [contenteditable], .tiptap-container')) {
            return
          }
          // Double-click on body text: enter edit mode immediately (works even on unselected nodes)
          if (!bodyEditing && e.detail === 2) {
            startEditing('body')
            return
          }
          onDragStart(e, node.id, node.position_x, node.position_y)
        }}
      >
        {children}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-40 transition-opacity rounded-br-2xl"
        onMouseDown={onResizeStart}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full text-text-muted">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" opacity="0.3" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  )
})
