import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Eraser, Undo2, Redo2, Type, Lock, Download } from 'lucide-react'
import getStroke from 'perfect-freehand'
import { useNodeStore } from '@/stores/node-store'
import { nanoid } from 'nanoid'
import { exportNodeAsImage, downloadFile } from '@/lib/export'
import type { FlowNode, DrawData, DrawStroke } from '@/types/database'

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

export function DrawNodeExpanded({ node }: { node: FlowNode }) {
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
  const [eraserPos, setEraserPos] = useState<number[] | null>(null)
  const drawing = useRef(false)
  const eraserUndoPushed = useRef(false)
  const pointsRef = useRef<number[][]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const isLocked = node.is_locked

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
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isLocked) return

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

  const handleExportImage = async () => {
    const blob = await exportNodeAsImage(node)
    downloadFile(blob, 'drawing.png', 'image/png')
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
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-wrap">
        <button onClick={() => setTool('pen')} className={`rounded p-1.5 cursor-pointer ${tool === 'pen' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => setTool('eraser')} className={`rounded p-1.5 cursor-pointer ${tool === 'eraser' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
          <Eraser className="h-4 w-4" />
        </button>
        <button onClick={() => setTool('text')} className={`rounded p-1.5 cursor-pointer ${tool === 'text' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}>
          <Type className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="h-5 w-5 rounded-full border-2 cursor-pointer transition hover:scale-110"
            style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
          />
        ))}

        {recentColors.filter((rc) => !COLORS.includes(rc)).length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            {recentColors.filter((rc) => !COLORS.includes(rc)).map((c) => (
              <button
                key={`recent-${c}`}
                onClick={() => setColor(c)}
                className="h-5 w-5 rounded-full border-2 cursor-pointer transition hover:scale-110"
                style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
              />
            ))}
          </>
        )}

        <div className="w-px h-5 bg-border" />

        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`rounded px-2 py-0.5 text-xs cursor-pointer flex items-center gap-1.5 ${size === s ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}
          >
            <div className="rounded-full bg-current" style={{ width: Math.min(s + 2, 14), height: Math.min(s + 2, 14) }} />
            {s}px
          </button>
        ))}

        <div className="w-px h-5 bg-border" />
        <button onClick={undo} disabled={undoStack.length === 0} className="rounded p-1.5 text-text-muted hover:text-text cursor-pointer disabled:opacity-30">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={redo} disabled={redoStack.length === 0} className="rounded p-1.5 text-text-muted hover:text-text cursor-pointer disabled:opacity-30">
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border" />
        <button onClick={handleExportImage} className="rounded p-1.5 text-text-muted hover:text-text cursor-pointer" title="Export as PNG">
          <Download className="h-4 w-4" />
        </button>

        {isLocked && (
          <>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-1 text-text-muted text-xs">
              <Lock className="h-3.5 w-3.5" /> Locked
            </div>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {isLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/30">
            <Lock className="h-8 w-8 text-text-muted" />
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
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
                <text
                  key={stroke.id}
                  x={stroke.points[0][0]}
                  y={stroke.points[0][1]}
                  fill={textColor}
                  fontSize={stroke.size * 4}
                  fontFamily="Inter, sans-serif"
                >
                  {text}
                </text>
              )
            }
            const outline = getStroke(stroke.points, { size: stroke.size, smoothing: 0.5, thinning: 0.5 })
            return <path key={stroke.id} d={getSvgPathFromStroke(outline)} fill={stroke.color} />
          })}
          {currentPoints.length > 1 && tool === 'pen' && (
            <path
              d={getSvgPathFromStroke(getStroke(currentPoints, { size, smoothing: 0.5, thinning: 0.5 }))}
              fill={color}
            />
          )}
          {tool === 'eraser' && eraserPos && (
            <circle cx={eraserPos[0]} cy={eraserPos[1]} r={size * 4 + 8} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          )}
        </svg>

        {textInput && (
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
            className="absolute bg-transparent outline-none text-text"
            style={{ left: textInput.x, top: textInput.y, fontSize: size * 4, color }}
          />
        )}
      </div>
    </div>
  )
}
