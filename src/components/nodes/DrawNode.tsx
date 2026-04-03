import { memo, useRef, useState, useCallback, useEffect } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Pencil, Eraser, Undo, Redo } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
}

const COLORS = ['#ffffff', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#f472b6']
const WIDTHS = [2, 4, 8]

export const DrawNode = memo(function DrawNode(props: NodeProps) {
  const data = props.data as { strokes?: Stroke[]; _dbNode: unknown }
  const updateNode = useNodeStore((s) => s.updateNode)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>((data.strokes ?? []) as Stroke[])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])
  const isDrawing = useRef(false)

  const drawAll = useCallback(
    (ctx: CanvasRenderingContext2D, allStrokes: Stroke[], active?: Stroke | null) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      const toDraw = active ? [...allStrokes, active] : allStrokes
      for (const stroke of toDraw) {
        if (stroke.points.length < 2) continue
        ctx.beginPath()
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.stroke()
      }
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAll(ctx, strokes, currentStroke)
  }, [strokes, currentStroke, drawAll])

  const getPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent) => {
    isDrawing.current = true
    const pos = getPos(e)
    setCurrentStroke({
      points: [pos],
      color: tool === 'eraser' ? '#0a0a0f' : color,
      width: tool === 'eraser' ? 20 : strokeWidth,
    })
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing.current || !currentStroke) return
    const pos = getPos(e)
    setCurrentStroke((s) => s && ({ ...s, points: [...s.points, pos] }))
  }

  const endDraw = () => {
    if (!isDrawing.current || !currentStroke) return
    isDrawing.current = false
    const newStrokes = [...strokes, currentStroke]
    setUndoStack((s) => [...s, strokes])
    setRedoStack([])
    setStrokes(newStrokes)
    setCurrentStroke(null)
    updateNode(props.id, { data: { strokes: newStrokes as unknown as Json[], _dbNode: undefined } })
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((s) => [...s, strokes])
    setStrokes(prev)
    setUndoStack((s) => s.slice(0, -1))
    updateNode(props.id, { data: { strokes: prev as unknown as Json[], _dbNode: undefined } })
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((s) => [...s, strokes])
    setStrokes(next)
    setRedoStack((s) => s.slice(0, -1))
    updateNode(props.id, { data: { strokes: next as unknown as Json[], _dbNode: undefined } })
  }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-draw)"
      icon={<Pencil className="h-3.5 w-3.5" />}
      title="Draw"
    >
      {/* Toolbar */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setTool('pen')}
          className={cn('rounded p-1', tool === 'pen' ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={cn('rounded p-1', tool === 'eraser' ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover')}
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-border" />
        <button onClick={undo} className="rounded p-1 text-text-muted hover:bg-bg-hover">
          <Undo className="h-3.5 w-3.5" />
        </button>
        <button onClick={redo} className="rounded p-1 text-text-muted hover:bg-bg-hover">
          <Redo className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-border" />
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn('h-4 w-4 rounded-full border', color === c ? 'border-accent ring-1 ring-accent' : 'border-border')}
            style={{ background: c }}
          />
        ))}
        <div className="h-4 w-px bg-border" />
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setStrokeWidth(w)}
            className={cn('rounded p-1 text-xs', strokeWidth === w ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover')}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={460}
        height={300}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        className="w-full cursor-crosshair rounded border border-border bg-bg"
        style={{ touchAction: 'none' }}
      />
    </BaseNode>
  )
})
