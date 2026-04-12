import { useCallback, useEffect, useRef, useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import type { FlowNode, Connection, NodeType, Json } from '@/types/database'

const NODE_RADIUS = 16
const LABEL_OFFSET = 24

const typeColors: Record<NodeType, string> = {
  task: '#60a5fa',
  note: '#facc15',
  doc: '#4ade80',
  table: '#a78bfa',
  event: '#fb923c',
  browser: '#22d3ee',
  draw: '#f472b6',
  tab: '#9ca3af',
  grouple: '#818cf8',
}

function getNodeLabel(node: FlowNode): string {
  const d = node.data as Record<string, Json>
  if (d && typeof d === 'object') {
    if (typeof d.title === 'string' && d.title) return d.title.slice(0, 30)
    if (typeof d.content === 'string' && d.content) return d.content.slice(0, 30)
    if (typeof d.label === 'string' && d.label) return d.label.slice(0, 30)
  }
  return node.type
}

interface SimNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  node: FlowNode
  label: string
  color: string
}

interface SimEdge {
  source: string
  target: string
}

export function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  const allNodes = useNodeStore((s) => s.allNodes)
  const allConnections = useNodeStore((s) => s.allConnections)
  const workspaces = useFolderStore((s) => s.workspaces)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspaceTab = useTabStore((s) => s.openWorkspace)
  const fetchNodes = useNodeStore((s) => s.fetchNodes)
  const fetchConnections = useNodeStore((s) => s.fetchConnections)

  // Camera state
  const camRef = useRef({ x: 0, y: 0, zoom: 1 })
  const [, forceRender] = useState(0)

  // Simulation data
  const simNodesRef = useRef<SimNode[]>([])
  const simEdgesRef = useRef<SimEdge[]>([])
  const draggingRef = useRef<{ nodeId: string | null; panStart: { mx: number; my: number; cx: number; cy: number } | null }>({ nodeId: null, panStart: null })
  const hoveredRef = useRef<string | null>(null)

  // Initialize simulation
  useEffect(() => {
    const nodeMap = new Map<string, number>()
    const count = allNodes.length
    const spread = Math.max(300, Math.sqrt(count) * 60)

    simNodesRef.current = allNodes.map((node, i) => {
      nodeMap.set(node.id, i)
      // Spread initial positions in a circle
      const angle = (i / Math.max(count, 1)) * Math.PI * 2
      const r = spread * 0.5 * Math.sqrt(Math.random())
      return {
        id: node.id,
        x: Math.cos(angle) * r + (Math.random() - 0.5) * 50,
        y: Math.sin(angle) * r + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        node,
        label: getNodeLabel(node),
        color: typeColors[node.type] ?? '#9ca3af',
      }
    })

    simEdgesRef.current = allConnections
      .filter((c) => nodeMap.has(c.source_node_id) && nodeMap.has(c.target_node_id))
      .map((c) => ({ source: c.source_node_id, target: c.target_node_id }))
  }, [allNodes, allConnections])

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      canvas.style.width = `${container.clientWidth}px`
      canvas.style.height = `${container.clientHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Force simulation + render loop
  useEffect(() => {
    let cooling = 1.0

    const tick = () => {
      const nodes = simNodesRef.current
      const edges = simEdgesRef.current
      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(tick)
        return
      }

      const nodeMap = new Map(nodes.map((n, i) => [n.id, i]))

      // Apply forces
      const alpha = cooling * 0.3
      cooling = Math.max(cooling * 0.998, 0.01)

      // Repulsion (all pairs, capped for performance)
      const maxPairs = 5000
      const step = nodes.length > 100 ? Math.ceil((nodes.length * nodes.length) / maxPairs) : 1

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j += step) {
          const a = nodes[i], b = nodes[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (200 * alpha) / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx -= fx; a.vy -= fy
          b.vx += fx; b.vy += fy
        }
      }

      // Attraction (edges)
      for (const edge of edges) {
        const ai = nodeMap.get(edge.source)
        const bi = nodeMap.get(edge.target)
        if (ai === undefined || bi === undefined) continue
        const a = nodes[ai], b = nodes[bi]
        let dx = b.x - a.x, dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 80) * 0.005 * alpha
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx; a.vy += fy
        b.vx -= fx; b.vy -= fy
      }

      // Gravity toward center
      for (const n of nodes) {
        n.vx -= n.x * 0.001 * alpha
        n.vy -= n.y * 0.001 * alpha
      }

      // Integrate with damping
      for (const n of nodes) {
        if (draggingRef.current.nodeId === n.id) {
          n.vx = 0; n.vy = 0
          continue
        }
        n.vx *= 0.85; n.vy *= 0.85
        n.x += n.vx; n.y += n.vy
      }

      // Render
      const canvas = canvasRef.current
      if (!canvas) { animRef.current = requestAnimationFrame(tick); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { animRef.current = requestAnimationFrame(tick); return }

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const cam = camRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      ctx.save()
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y)
      ctx.scale(cam.zoom, cam.zoom)

      // Draw edges
      ctx.strokeStyle = 'rgba(120, 120, 140, 0.25)'
      ctx.lineWidth = 1
      for (const edge of edges) {
        const ai = nodeMap.get(edge.source)
        const bi = nodeMap.get(edge.target)
        if (ai === undefined || bi === undefined) continue
        const a = nodes[ai], b = nodes[bi]
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // Draw nodes
      const hovered = hoveredRef.current
      for (const n of nodes) {
        const isHovered = n.id === hovered
        const r = isHovered ? NODE_RADIUS + 3 : NODE_RADIUS

        // Glow for hovered
        if (isHovered) {
          ctx.shadowColor = n.color
          ctx.shadowBlur = 12
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()

        if (isHovered) {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
      }

      // Draw label only for hovered node
      if (hovered) {
        const hn = nodes.find((n) => n.id === hovered)
        if (hn) {
          ctx.font = '11px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(220, 220, 230, 0.95)'
          ctx.fillText(hn.label, hn.x, hn.y + LABEL_OFFSET + 4)
        }
      }

      ctx.restore()

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [allNodes, allConnections])

  // Screen coords to world coords
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const cam = camRef.current
    const cx = rect.width / 2 + cam.x
    const cy = rect.height / 2 + cam.y
    return {
      x: (sx - rect.left - cx) / cam.zoom,
      y: (sy - rect.top - cy) / cam.zoom,
    }
  }, [])

  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = simNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      const dx = n.x - wx, dy = n.y - wy
      if (dx * dx + dy * dy <= (NODE_RADIUS + 4) * (NODE_RADIUS + 4)) return n
    }
    return null
  }, [])

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const hit = findNodeAt(world.x, world.y)

    if (hit) {
      draggingRef.current = { nodeId: hit.id, panStart: null }
      const onMove = (me: MouseEvent) => {
        const w = screenToWorld(me.clientX, me.clientY)
        const n = simNodesRef.current.find((sn) => sn.id === hit.id)
        if (n) { n.x = w.x; n.y = w.y }
      }
      const onUp = () => {
        draggingRef.current.nodeId = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    } else {
      // Pan
      const cam = camRef.current
      draggingRef.current = { nodeId: null, panStart: { mx: e.clientX, my: e.clientY, cx: cam.x, cy: cam.y } }
      const onMove = (me: MouseEvent) => {
        const ps = draggingRef.current.panStart
        if (!ps) return
        camRef.current.x = ps.cx + (me.clientX - ps.mx)
        camRef.current.y = ps.cy + (me.clientY - ps.my)
      }
      const onUp = () => {
        draggingRef.current.panStart = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
  }, [screenToWorld, findNodeAt])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const hit = findNodeAt(world.x, world.y)
    hoveredRef.current = hit?.id ?? null
    const canvas = canvasRef.current
    if (canvas) canvas.style.cursor = hit ? 'pointer' : 'grab'
  }, [screenToWorld, findNodeAt])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const hit = findNodeAt(world.x, world.y)
    if (!hit) return
    const ws = workspaces.find((w) => w.id === hit.node.workspace_id)
    if (ws) {
      setActiveWorkspace(ws.id)
      openWorkspaceTab(ws.id, ws.name)
      fetchNodes(ws.id)
      fetchConnections(ws.id)
    }
  }, [screenToWorld, findNodeAt, workspaces, setActiveWorkspace, openWorkspaceTab, fetchNodes, fetchConnections])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const cam = camRef.current
    if (e.shiftKey) {
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      cam.zoom = Math.max(0.1, Math.min(5, cam.zoom * factor))
    } else {
      cam.x += e.deltaX / cam.zoom
      cam.y += e.deltaY / cam.zoom
    }
  }, [])

  // Legend
  const typesPresent = new Set(allNodes.map((n) => n.type))

  return (
    <div ref={containerRef} className="h-full w-full relative bg-bg overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        className="absolute inset-0"
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-bg-secondary/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-[10px] flex flex-wrap gap-x-3 gap-y-1">
        {Array.from(typesPresent).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeColors[t] }} />
            <span className="text-text-muted capitalize">{t}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 text-[10px] text-text-muted bg-bg-secondary/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2">
        {allNodes.length} nodes, {allConnections.length} connections
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 text-[10px] text-text-muted bg-bg-secondary/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2">
        Drag to pan. Scroll to zoom. Double-click a node to open its workspace.
      </div>
    </div>
  )
}
