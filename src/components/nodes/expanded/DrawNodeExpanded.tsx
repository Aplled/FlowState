import { useCallback, useRef, useState } from 'react'
import { Pencil, Eraser, Undo2, Type } from 'lucide-react'
import getStroke from 'perfect-freehand'
import { useNodeStore } from '@/stores/node-store'
import { nanoid } from 'nanoid'
import type { FlowNode, DrawData, DrawStroke } from '@/types/database'

const COLORS = ['#e8e8f0', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa', '#f472b6']
const SIZES = [2, 4, 8, 16]

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
  const [undoStack, setUndoStack] = useState<DrawStroke[][]>([])
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const patchData = (patch: Partial<DrawData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const getPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return

    if (tool === 'text') {
      const pt = getPoint(e)
      setTextInput({ x: pt[0], y: pt[1] })
      setTextValue('')
      return
    }

    drawing.current = true
    setCurrentPoints([getPoint(e)])
  }, [tool])

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current) return
    const pt = getPoint(e)

    if (tool === 'eraser') {
      // Remove strokes that intersect with eraser path
      const eraserRadius = size * 2
      const remaining = data.strokes.filter((stroke) => {
        return !stroke.points.some((sp) => {
          const dx = sp[0] - pt[0]
          const dy = sp[1] - pt[1]
          return dx * dx + dy * dy < eraserRadius * eraserRadius
        })
      })
      if (remaining.length !== data.strokes.length) {
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
      setUndoStack((prev) => [...prev, data.strokes])
      patchData({ strokes: [...data.strokes, stroke] })
    }
    setCurrentPoints([])
  }, [tool, currentPoints, color, size, data.strokes])

  const commitText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    // Store text as a special stroke with a single point and the text in color field prefixed with "text:"
    const textStroke: DrawStroke = {
      id: nanoid(8),
      points: [[textInput.x, textInput.y]],
      color: `text:${color}:${textValue}`,
      size,
    }
    setUndoStack((prev) => [...prev, data.strokes])
    patchData({ strokes: [...data.strokes, textStroke] })
    setTextInput(null)
    setTextValue('')
  }

  const undo = () => {
    if (undoStack.length === 0) return
    patchData({ strokes: undoStack[undoStack.length - 1] })
    setUndoStack((s) => s.slice(0, -1))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
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
        <div className="w-px h-5 bg-border" />
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`rounded px-2 py-0.5 text-xs cursor-pointer ${size === s ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}`}
          >
            {s}px
          </button>
        ))}
        <div className="w-px h-5 bg-border" />
        <button onClick={undo} className="rounded p-1.5 text-text-muted hover:text-text cursor-pointer">
          <Undo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: data.background, cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
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
        </svg>

        {/* Text input overlay */}
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
