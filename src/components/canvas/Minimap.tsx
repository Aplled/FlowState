import { memo, useCallback, useMemo } from 'react'
import { Crosshair } from 'lucide-react'
import type { FlowNode } from '@/types/database'
import type { ViewportState } from '@/hooks/useCanvas'

interface MinimapProps {
  nodes: FlowNode[]
  viewport: ViewportState
  canvasWidth: number
  canvasHeight: number
  onRecenter: () => void
  onNavigate: (canvasX: number, canvasY: number) => void
}

const NODE_COLORS: Record<string, string> = {
  task: '#f59e0b',
  note: '#a78bfa',
  doc: '#3b82f6',
  table: '#14b8a6',
  event: '#f472b6',
  browser: '#6366f1',
  draw: '#22c55e',
  tab: '#64748b',
  grouple: '#8b5cf6',
}

const MAP_W = 160
const MAP_H = 100

export const Minimap = memo(function Minimap({ nodes, viewport, canvasWidth, canvasHeight, onRecenter, onNavigate }: MinimapProps) {
  const { bounds, scale } = useMemo(() => {
    if (nodes.length === 0) {
      return { bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 800 }, scale: MAP_W / 1000 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.position_x)
      minY = Math.min(minY, n.position_y)
      maxX = Math.max(maxX, n.position_x + n.width)
      maxY = Math.max(maxY, n.position_y + n.height)
    }
    const pad = 200
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    const w = maxX - minX || 1
    const h = maxY - minY || 1
    const scale = Math.min(MAP_W / w, MAP_H / h)
    return { bounds: { minX, minY, maxX, maxY }, scale }
  }, [nodes])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const canvasX = mx / scale + bounds.minX
    const canvasY = my / scale + bounds.minY
    onNavigate(canvasX, canvasY)
  }, [scale, bounds, onNavigate])

  // Viewport rect in minimap coords
  const vx = (-viewport.x / viewport.zoom - bounds.minX) * scale
  const vy = (-viewport.y / viewport.zoom - bounds.minY) * scale
  const vw = (canvasWidth / viewport.zoom) * scale
  const vh = (canvasHeight / viewport.zoom) * scale

  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-bg-secondary/90 overflow-hidden shadow-lg">
      <svg width={MAP_W} height={MAP_H} className="cursor-pointer" onClick={handleClick}>
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={(n.position_x - bounds.minX) * scale}
            y={(n.position_y - bounds.minY) * scale}
            width={Math.max(n.width * scale, 2)}
            height={Math.max(n.height * scale, 2)}
            rx={1}
            fill={NODE_COLORS[n.type] ?? '#6366f1'}
            opacity={0.8}
          />
        ))}
        <rect
          x={vx}
          y={vy}
          width={vw}
          height={vh}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          rx={1}
          opacity={0.6}
        />
      </svg>
      <button
        onClick={onRecenter}
        className="absolute top-1 right-1 p-0.5 rounded text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer transition"
        title="Recenter view"
      >
        <Crosshair className="h-3 w-3" />
      </button>
    </div>
  )
})
