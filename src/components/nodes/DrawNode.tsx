import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Eraser, Undo2, Redo2, Type, Lock, Maximize2, Minimize2 } from 'lucide-react'
import getStroke from 'perfect-freehand'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { useLayoutStore } from '@/stores/layout-store'
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
  '#3d3429', '#a0522d', '#b8860b', '#5a7c5a', '#5b7fa5', '#9a7eb0',
  '#9c8e7c', '#8b6f4e', '#c47a6a', '#6b5f50', '#7a9ab0', '#d0c7b6',
]
const SIZES = [1, 2, 4, 8, 16]
const MAX_HISTORY = 50
const DEFAULT_CANVAS_W = 520
const DEFAULT_CANVAS_H = 360

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
  const compact = useLayoutStore((s) => s.compactNodeHeaders)
  const [drawTitle, setDrawTitle] = useState((data as any).title || 'Draw')

  const [color, setColor] = useState('#3d3429')
  const [size, setSize] = useState(4)
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen')
  const [currentPoints, setCurrentPoints] = useState<number[][]>([])
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const [eraserPos, setEraserPos] = useState<number[] | null>(null)
  const drawing = useRef(false)
  const eraserUndoPushed = useRef(false)
  const pointsRef = useRef<number[][]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const isLocked = node.is_locked
  const cw = data.canvasWidth || DEFAULT_CANVAS_W
  const ch = data.canvasHeight || DEFAULT_CANVAS_H

  const getLatestData = () => {
    const n = useNodeStore.getState().nodes.find((n) => n.id === node.id)
    return (n?.data as unknown as DrawData) ?? data
  }

  const patchData = (patch: Partial<DrawData>) => {
    const fresh = getLatestData()
    updateNode(node.id, { data: { ...fresh, ...patch } as unknown as FlowNode['data'] })
  }

  const pushUndo = (strokes: DrawStroke[]) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { strokes }])
    setRedoStack([])
  }

  const addRecentColor = (c: string) => {
    setRecentColors((prev) => [c, ...prev.filter((rc) => rc !== c)].slice(0, 5))
  }

  const getPoint = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    // SVG may be larger than its scrollable container, so we need to account
    // for the difference between the SVG's actual position and the viewport.
    const scrollContainer = svg.parentElement
    const scrollLeft = scrollContainer?.scrollLeft ?? 0
    const scrollTop = scrollContainer?.scrollTop ?? 0
    return [e.clientX - rect.left + scrollLeft, e.clientY - rect.top + scrollTop]
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
    eraserUndoPushed.current = false
    const pt = getPoint(e)
    pointsRef.current = [pt]
    setCurrentPoints([pt])
  }, [tool, isLocked])

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    const pt = getPoint(e)

    if (tool === 'eraser') {
      setEraserPos(pt)
    }

    if (!drawing.current) return

    pointsRef.current = [...pointsRef.current, pt]
    setCurrentPoints(pointsRef.current)

    if (tool === 'eraser') {
      const eraserRadius = size * 4 + 8
      const fresh = getLatestData()
      const remaining = fresh.strokes.filter((stroke) => {
        if (stroke.color.startsWith('text:')) {
          const dx = stroke.points[0][0] - pt[0]
          const dy = stroke.points[0][1] - pt[1]
          return dx * dx + dy * dy >= eraserRadius * eraserRadius
        }
        return !stroke.points.some((sp) => {
          const dx = sp[0] - pt[0]
          const dy = sp[1] - pt[1]
          return dx * dx + dy * dy < eraserRadius * eraserRadius
        })
      })
      if (remaining.length !== fresh.strokes.length) {
        if (!eraserUndoPushed.current) {
          pushUndo(fresh.strokes)
          eraserUndoPushed.current = true
        }
        patchData({ strokes: remaining })
      }
    }
  }, [tool, size])

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false

    if (tool === 'pen' && pointsRef.current.length > 1) {
      const stroke: DrawStroke = { id: nanoid(8), points: pointsRef.current, color, size }
      const fresh = getLatestData()
      pushUndo(fresh.strokes)
      patchData({ strokes: [...fresh.strokes, stroke] })
      addRecentColor(color)
    }
    pointsRef.current = []
    setCurrentPoints([])
  }, [tool, color, size])

  const commitText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    const textStroke: DrawStroke = {
      id: nanoid(8),
      points: [[textInput.x, textInput.y]],
      color: `text:${color}:${textValue}`,
      size,
    }
    const fresh = getLatestData()
    pushUndo(fresh.strokes)
    patchData({ strokes: [...fresh.strokes, textStroke] })
    setTextInput(null)
    setTextValue('')
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    const fresh = getLatestData()
    setRedoStack((rs) => [...rs, { strokes: fresh.strokes }])
    patchData({ strokes: prev.strokes })
    setUndoStack((s) => s.slice(0, -1))
  }, [undoStack])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const fresh = getLatestData()
    setUndoStack((us) => [...us, { strokes: fresh.strokes }])
    patchData({ strokes: next.strokes })
    setRedoStack((s) => s.slice(0, -1))
  }, [redoStack])

  const expandCanvas = () => {
    patchData({ canvasWidth: cw * 2, canvasHeight: ch * 2 })
    updateNode(node.id, {
      width: node.width * 1.5,
      height: node.height * 1.5,
    })
  }

  const shrinkCanvas = () => {
    if (cw <= DEFAULT_CANVAS_W) return
    patchData({ canvasWidth: Math.max(cw / 2, DEFAULT_CANVAS_W), canvasHeight: Math.max(ch / 2, DEFAULT_CANVAS_H) })
  }

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

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#5a7c5a"
      icon={isLocked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
      title={drawTitle}
      titleInput={
        <input
          value={drawTitle}
          onChange={(e) => {
            setDrawTitle(e.target.value)
            patchData({ title: e.target.value } as any)
          }}
          placeholder="Draw title..."
          className="w-full bg-transparent text-xs font-medium text-text placeholder:text-text-muted outline-none cursor-text"
        />
      }
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <button onClick={() => setTool('pen')} className={`rounded-lg p-1 cursor-pointer transition-colors ${tool === 'pen' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTool('eraser')} className={`rounded-lg p-1 cursor-pointer transition-colors ${tool === 'eraser' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Eraser className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTool('text')} className={`rounded-lg p-1 cursor-pointer transition-colors ${tool === 'text' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text'}`}>
            <Type className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-border/60" />

          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded-lg p-1 cursor-pointer flex items-center justify-center transition-colors ${size === s ? 'bg-accent/15' : 'hover:bg-bg-hover'}`}
              title={`${s}px`}
            >
              <div className="rounded-full bg-current" style={{ width: Math.min(s + 2, 12), height: Math.min(s + 2, 12) }} />
            </button>
          ))}
          <div className="h-4 w-px bg-border/60" />

          <button onClick={undo} disabled={undoStack.length === 0} className="rounded-lg p-1 text-text-muted hover:text-text cursor-pointer disabled:opacity-30 transition-colors">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="rounded-lg p-1 text-text-muted hover:text-text cursor-pointer disabled:opacity-30 transition-colors">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-border/60" />

          <button onClick={expandCanvas} className="rounded-lg p-1 text-text-muted hover:text-text cursor-pointer transition-colors" title="Expand canvas 2x">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {cw > DEFAULT_CANVAS_W && (
            <button onClick={shrinkCanvas} className="rounded-lg p-1 text-text-muted hover:text-text cursor-pointer transition-colors" title="Shrink canvas">
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Color palette */}
        <div className="flex items-center gap-1 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-4 w-4 rounded-full border-2 cursor-pointer transition hover:scale-110"
              style={{ background: c, borderColor: c === color ? 'var(--color-text)' : 'transparent' }}
            />
          ))}
          {recentColors.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-border/60 mx-0.5" />
              {recentColors.filter((rc) => !COLORS.includes(rc)).map((c) => (
                <button
                  key={`recent-${c}`}
                  onClick={() => setColor(c)}
                  className="h-4 w-4 rounded-full border-2 cursor-pointer transition hover:scale-110"
                  style={{ background: c, borderColor: c === color ? 'var(--color-text)' : 'transparent' }}
                />
              ))}
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="relative overflow-auto rounded-xl border border-border/60" style={{ maxHeight: node.height - 120 }}>
          {isLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40 rounded-xl">
              <Lock className="h-6 w-6 text-text-muted" />
            </div>
          )}
          <svg
            ref={svgRef}
            width={cw}
            height={ch}
            style={{
              minWidth: '100%',
              background: data.background,
              cursor: isLocked ? 'not-allowed' : tool === 'text' ? 'text' : tool === 'eraser' ? 'none' : 'crosshair',
            }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={() => { onPointerUp(); setEraserPos(null) }}
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
            {tool === 'eraser' && eraserPos && (
              <circle cx={eraserPos[0]} cy={eraserPos[1]} r={size * 4 + 8} fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
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
