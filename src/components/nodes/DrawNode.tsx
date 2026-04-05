import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Eraser, Undo2, Redo2, Type, Lock } from 'lucide-react'
import getStroke from 'perfect-freehand'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { nanoid } from 'nanoid'
import type { FlowNode, DrawData, DrawStroke } from '@/types/database'

interface DrawNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

const COLORS = [
  '#e8e8f0', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa',
  '#f472b6', '#14b8a6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4',
]
const SIZES = [1, 2, 4, 8, 16]
const MAX_HISTORY = 50

interface HistoryEntry {
  strokes: DrawStroke[]
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (stroke.length < 2) return ''
  const d = [`M ${stroke[0][0]} ${stroke[0][1]}`]
  for (let i = 1; i < stroke.length; i++) {
    d.push(`L ${stroke[i][0]} ${stroke[i][1]}`)
  }
  d.push('Z')
  return d.join(' ')
}

export const DrawNode = memo(function DrawNode({ node, selected, connectTarget, onDragStart, onSelect }: DrawNodeProps) {
  const data = node.data as unknown as DrawData
  const updateNode = useNodeStore((s) => s.updateNode)

  const [color, setColor] = useState('#e8e8f0')
  const [size, setSize] = useState(4)
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen')
  const [currentPoints, setCurrentPoints] = useState<number[][]>([])
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const isLocked = node.is_locked

  const patchData = (patch: Partial<DrawData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const pushUndo = (strokes: DrawStroke[]) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { strokes }])
    setRedoStack([])
  }

  const addRecentColor = (c: string) => {
    setRecentColors((prev) => [c, ...prev.filter((rc) => rc !== c)].slice(0, 5))
  }

  const getPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return
    e.stopPropagation()

    if (tool === 'text') {
      const pt = getPoint(e)
      setTextInput({ x: pt[0], y: pt[1] })
      setTextValue('')
      return
    }

    drawing.current = true
    setCurrentPoints([getPoint(e)])
  }, [tool, isLocked])

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current) return
    const pt = getPoint(e)

    if (tool === 'eraser') {
      const eraserRadius = size * 3
      const remaining = data.strokes.filter((stroke) => {
        if (stroke.color.startsWith('text:')) {
          const dx = stroke.points[0][0] - pt[0]
          const dy = stroke.points[0][1] - pt[1]
          return dx * dx + dy * dy >= eraserRadius * eraserRadius * 4
        }
        return !stroke.points.some((sp) => {
          const dx = sp[0] - pt[0]
          const dy = sp[1] - pt[1]
          return dx * dx + dy * dy < eraserRadius * eraserRadius
        })
      })
      if (remaining.length !== data.strokes.length) {
        pushUndo(data.strokes)
        patchData({ strokes: remaining })
      }
    }

    setCurrentPoints((prev) => [...prev, pt])
  }, [tool, size, data.strokes])

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false

    if (tool === 'pen' && currentPoints.length > 1) {
      const stroke: DrawStroke = { id: nanoid(8), points: currentPoints, color, size }
      pushUndo(data.strokes)
      patchData({ strokes: [...data.strokes, stroke] })
      addRecentColor(color)
    }
    setCurrentPoints([])
  }, [tool, currentPoints, color, size, data.strokes])

  const commitText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    const textStroke: DrawStroke = {
      id: nanoid(8),
      points: [[textInput.x, textInput.y]],
      color: `text:${color}:${textValue}`,
      size,
    }
    pushUndo(data.strokes)
    patchData({ strokes: [...data.strokes, textStroke] })
    setTextInput(null)
    setTextValue('')
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((rs) => [...rs, { strokes: data.strokes }])
    patchData({ strokes: prev.strokes })
    setUndoStack((s) => s.slice(0, -1))
  }, [undoStack, data.strokes])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((us) => [...us, { strokes: data.strokes }])
    patchData({ strokes: next.strokes })
    setRedoStack((s) => s.slice(0, -1))
  }, [redoStack, data.strokes])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) { redo() } else { undo() }
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const canvasHeight = node.height - 120

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#22c55e"
      icon={isLocked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
      title="Draw"
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <button onClick={() => setTool('pen')} className={`rounded p-1 cursor-pointer ${tool === 'pen' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTool('eraser')} className={`rounded p-1 cursor-pointer ${tool === 'eraser' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Eraser className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTool('text')} className={`rounded p-1 cursor-pointer ${tool === 'text' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Type className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-border" />

          {/* Size presets */}
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded p-1 cursor-pointer flex items-center justify-center ${size === s ? 'bg-accent/20' : 'hover:bg-bg-hover'}`}
              title={`${s}px`}
            >
              <div className="rounded-full bg-current" style={{ width: Math.min(s + 2, 12), height: Math.min(s + 2, 12) }} />
            </button>
          ))}
          <div className="h-4 w-px bg-border" />

          <button onClick={undo} disabled={undoStack.length === 0} className="rounded p-1 text-text-muted hover:text-text cursor-pointer disabled:opacity-30">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="rounded p-1 text-text-muted hover:text-text cursor-pointer disabled:opacity-30">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Color palette */}
        <div className="flex items-center gap-1 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-3.5 w-3.5 rounded-full border cursor-pointer transition hover:scale-110"
              style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
            />
          ))}
          {recentColors.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-border mx-0.5" />
              {recentColors.filter((rc) => !COLORS.includes(rc)).map((c) => (
                <button
                  key={`recent-${c}`}
                  onClick={() => setColor(c)}
                  className="h-3.5 w-3.5 rounded-full border cursor-pointer transition hover:scale-110"
                  style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
                />
              ))}
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="relative">
          {isLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40 rounded">
              <Lock className="h-6 w-6 text-text-muted" />
            </div>
          )}
          <svg
            ref={svgRef}
            className="w-full rounded border border-border"
            style={{
              height: Math.max(canvasHeight, 100),
              background: data.background,
              cursor: isLocked ? 'not-allowed' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair',
            }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
          >
            {data.strokes.map((stroke) => {
              if (stroke.color.startsWith('text:')) {
                const parts = stroke.color.split(':')
                const textColor = parts[1]
                const text = parts.slice(2).join(':')
                return (
                  <text key={stroke.id} x={stroke.points[0][0]} y={stroke.points[0][1]} fill={textColor} fontSize={stroke.size * 3} fontFamily="Inter, sans-serif">
                    {text}
                  </text>
                )
              }
              const outline = getStroke(stroke.points, { size: stroke.size, smoothing: 0.5, thinning: 0.5 })
              return <path key={stroke.id} d={getSvgPathFromStroke(outline)} fill={stroke.color} />
            })}
            {currentPoints.length > 1 && tool === 'pen' && (
              <path d={getSvgPathFromStroke(getStroke(currentPoints, { size, smoothing: 0.5, thinning: 0.5 }))} fill={color} />
            )}
          </svg>

          {textInput && (
            <input
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
              className="absolute bg-transparent outline-none"
              style={{ left: textInput.x, top: textInput.y, fontSize: size * 3, color }}
            />
          )}
        </div>
      </div>
    </BaseNode>
  )
})
