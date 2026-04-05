import { memo, useState } from 'react'
import type { FlowNode, Connection, ConnectionDirection } from '@/types/database'
import { useNodeStore } from '@/stores/node-store'
import { X } from 'lucide-react'

interface ConnectionLayerProps {
  connections: Connection[]
  nodes: FlowNode[]
}

function getNodeCenter(node: FlowNode) {
  return {
    x: node.position_x + node.width / 2,
    y: node.position_y + node.height / 2,
  }
}

function getEdgePoint(node: FlowNode, from: { x: number; y: number }) {
  const cx = node.position_x + node.width / 2
  const cy = node.position_y + node.height / 2
  const hw = node.width / 2
  const hh = node.height / 2
  const dx = from.x - cx
  const dy = from.y - cy

  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const sx = hw / Math.abs(dx || 1)
  const sy = hh / Math.abs(dy || 1)
  const s = Math.min(sx, sy)

  return { x: cx + dx * s, y: cy + dy * s }
}

function buildPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
) {
  const dx = t.x - s.x
  const dy = t.y - s.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const curvature = Math.min(dist * 0.25, 80)

  if (Math.abs(dx) > Math.abs(dy)) {
    const sign = dx > 0 ? 1 : -1
    return `M${s.x},${s.y} C${s.x + curvature * sign},${s.y} ${t.x - curvature * sign},${t.y} ${t.x},${t.y}`
  }
  const sign = dy > 0 ? 1 : -1
  return `M${s.x},${s.y} C${s.x},${s.y + curvature * sign} ${t.x},${t.y - curvature * sign} ${t.x},${t.y}`
}

function getMidpoint(s: { x: number; y: number }, t: { x: number; y: number }) {
  return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }
}

const ARROW_SIZE = 8

function resolveDirection(conn: Connection): ConnectionDirection {
  if (conn.direction) return conn.direction
  return conn.is_directed ? 'directed' : 'undirected'
}

const DIRECTION_CYCLE: ConnectionDirection[] = ['directed', 'bidirectional', 'undirected']

export const ConnectionLayer = memo(function ConnectionLayer({ connections, nodes }: ConnectionLayerProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const updateConnection = useNodeStore((s) => s.updateConnection)
  const deleteConnection = useNodeStore((s) => s.deleteConnection)
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)

  const cycleDirection = (conn: Connection) => {
    const current = resolveDirection(conn)
    const idx = DIRECTION_CYCLE.indexOf(current)
    const next = DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length]
    updateConnection(conn.id, { direction: next })
  }

  return (
    <>
      <svg className="absolute inset-0" style={{ overflow: 'visible', zIndex: 0 }}>
        <defs>
          <marker
            id="arrowhead-end"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={ARROW_SIZE - 1}
            refY={ARROW_SIZE / 2}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d={`M0,1 L${ARROW_SIZE - 1},${ARROW_SIZE / 2} L0,${ARROW_SIZE - 1}`}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-start"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={1}
            refY={ARROW_SIZE / 2}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d={`M${ARROW_SIZE - 1},1 L1,${ARROW_SIZE / 2} L${ARROW_SIZE - 1},${ARROW_SIZE - 1}`}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        {connections.map((conn) => {
          const source = nodeMap.get(conn.source_node_id)
          const target = nodeMap.get(conn.target_node_id)
          if (!source || !target) return null

          const sc = getNodeCenter(source)
          const tc = getNodeCenter(target)
          const s = getEdgePoint(source, tc)
          const t = getEdgePoint(target, sc)
          const dir = resolveDirection(conn)

          const dashArray =
            conn.style === 'dashed' ? '8,4' : conn.style === 'dotted' ? '2,4' : undefined

          const pathD = buildPath(s, t)
          const isHovered = hoveredConnId === conn.id

          return (
            <g key={conn.id}>
              {/* Invisible wider hit area for clicking */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={(e) => { e.stopPropagation(); cycleDirection(conn) }}
                onMouseEnter={() => setHoveredConnId(conn.id)}
                onMouseLeave={() => setHoveredConnId(null)}
              />
              {/* Visible line */}
              <path
                d={pathD}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeDasharray={dashArray}
                markerEnd={dir === 'directed' || dir === 'bidirectional' ? 'url(#arrowhead-end)' : undefined}
                markerStart={dir === 'bidirectional' ? 'url(#arrowhead-start)' : undefined}
                opacity={isHovered ? 0.85 : 0.55}
                style={{ pointerEvents: 'none', transition: 'opacity 0.15s, stroke-width 0.15s' }}
              />
            </g>
          )
        })}
      </svg>

      {/* Delete buttons rendered as HTML overlays near hovered connection */}
      {connections.map((conn) => {
        if (hoveredConnId !== conn.id) return null
        const source = nodeMap.get(conn.source_node_id)
        const target = nodeMap.get(conn.target_node_id)
        if (!source || !target) return null

        const sc = getNodeCenter(source)
        const tc = getNodeCenter(target)
        const s = getEdgePoint(source, tc)
        const t = getEdgePoint(target, sc)
        const mid = getMidpoint(s, t)

        return (
          <div
            key={`del-${conn.id}`}
            className="absolute z-10"
            style={{ left: mid.x - 10, top: mid.y - 10 }}
            onMouseEnter={() => setHoveredConnId(conn.id)}
            onMouseLeave={() => setHoveredConnId(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); setHoveredConnId(null) }}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-danger/90 hover:bg-danger text-white shadow-lg cursor-pointer transition-transform hover:scale-110"
              title="Remove connection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </>
  )
})
