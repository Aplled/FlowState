import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanvas } from '@/hooks/useCanvas'
import { useNodeInteraction } from '@/hooks/useNodeInteraction'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import { useLayoutStore } from '@/stores/layout-store'
import { ConnectionLayer } from './ConnectionLayer'
import { CanvasContextMenu } from './CanvasContextMenu'
import { Minimap } from './Minimap'
import { NodeRenderer } from '@/components/nodes/NodeRenderer'
import type { NodeType } from '@/types/database'

export function Canvas() {
  const {
    nodes, connections, selectedNodeIds,
    setSelectedNodes, fetchNodes, fetchConnections,
    addNode, moveNode, persistNodePosition, addConnection, deleteNode,
    getCollapsedNodeIds, setParent,
  } = useNodeStore()
  const activeWorkspaceId = useFolderStore((s) => s.activeWorkspaceId)
  const activeWorkspace = useFolderStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const updateWorkspace = useFolderStore((s) => s.updateWorkspace)
  const openWorkspace = useTabStore((s) => s.openWorkspace)

  const canvasRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 800 })

  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [connectingTo, setConnectingTo] = useState<{ x: number; y: number } | null>(null)
  const [connectHoverNodeId, setConnectHoverNodeId] = useState<string | null>(null)

  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  const marqueeRef = useRef<{ startScreenX: number; startScreenY: number; priorSelection: string[] } | null>(null)

  const { viewport, setViewport, screenToCanvas, startPan, onPan, endPan, onWheel } = useCanvas({
    initialViewport: activeWorkspace
      ? { x: activeWorkspace.viewport_x, y: activeWorkspace.viewport_y, zoom: activeWorkspace.viewport_zoom || 1 }
      : undefined,
    onViewportChange: (vp) => {
      if (activeWorkspaceId) {
        updateWorkspace(activeWorkspaceId, { viewport_x: vp.x, viewport_y: vp.y, viewport_zoom: vp.zoom })
      }
    },
  })

  const collapsedIds = useMemo(() => getCollapsedNodeIds(), [nodes])
  const visibleNodes = useMemo(() => nodes.filter((n) => !collapsedIds.has(n.id)), [nodes, collapsedIds])
  const visibleConnections = useMemo(
    () => connections.filter((c) => !collapsedIds.has(c.source_node_id) && !collapsedIds.has(c.target_node_id)),
    [connections, collapsedIds],
  )

  const nodePositions = useMemo(
    () => new Map(visibleNodes.map((n) => [n.id, { x: n.position_x, y: n.position_y, width: n.width, height: n.height, type: n.type }])),
    [visibleNodes],
  )

  const handleDropOnGroup = useCallback((draggedId: string, groupId: string) => {
    setParent(draggedId, groupId)
  }, [setParent])

  const { startDrag, selectNode } = useNodeInteraction({
    viewport,
    onNodeMove: moveNode,
    onNodeMoveEnd: persistNodePosition,
    onSelectionChange: setSelectedNodes,
    selectedIds: selectedNodeIds,
    nodePositions,
    onDropOnGroup: handleDropOnGroup,
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedNodeIds.length === 0) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        for (const id of selectedNodeIds) deleteNode(id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeIds, deleteNode])

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchNodes(activeWorkspaceId)
      fetchConnections(activeWorkspaceId)
      if (activeWorkspace) {
        openWorkspace(activeWorkspaceId, activeWorkspace.name)
      }
    }
  }, [activeWorkspaceId])

  useEffect(() => {
    if (activeWorkspace) {
      setViewport({
        x: activeWorkspace.viewport_x,
        y: activeWorkspace.viewport_y,
        zoom: activeWorkspace.viewport_zoom || 1,
      })
    }
  }, [activeWorkspaceId])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.dataset.handle && target.dataset.nodeId) {
      e.stopPropagation()
      const rect = canvasRef.current!.getBoundingClientRect()
      const pos = screenToCanvas(e.clientX, e.clientY, rect)
      setConnectingFrom({ nodeId: target.dataset.nodeId, x: pos.x, y: pos.y })
      return
    }

    const isCanvasClick = e.target === e.currentTarget || (e.target as HTMLElement).closest?.('[data-canvas-bg]') !== null
    if (e.button === 0 && isCanvasClick) {
      setContextMenu(null)
      if (e.shiftKey) {
        const rect = canvasRef.current!.getBoundingClientRect()
        const pos = screenToCanvas(e.clientX, e.clientY, rect)
        marqueeRef.current = {
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          priorSelection: [...selectedNodeIds],
        }
        setMarquee({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y })
        return
      }
      if (selectedNodeIds.length > 0) setSelectedNodes([])
      startPan(e)
    }
    if (e.button === 1) {
      startPan(e)
    }
  }, [setSelectedNodes, startPan, screenToCanvas, selectedNodeIds])

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (connectingFrom) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const pos = screenToCanvas(e.clientX, e.clientY, rect)
      setConnectingTo(pos)

      const hoveredNode = visibleNodes.find((n) => {
        if (n.id === connectingFrom.nodeId) return false
        return pos.x >= n.position_x && pos.x <= n.position_x + n.width &&
               pos.y >= n.position_y && pos.y <= n.position_y + n.height
      })
      setConnectHoverNodeId(hoveredNode?.id ?? null)
      return
    }
    if (marquee && marqueeRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const pos = screenToCanvas(e.clientX, e.clientY, rect)
      setMarquee((m) => m ? { ...m, endX: pos.x, endY: pos.y } : null)

      const sx = Math.min(marquee.startX, pos.x)
      const sy = Math.min(marquee.startY, pos.y)
      const ex = Math.max(marquee.startX, pos.x)
      const ey = Math.max(marquee.startY, pos.y)
      const hit = visibleNodes
        .filter((n) => {
          const nx = n.position_x, ny = n.position_y
          const nx2 = nx + n.width, ny2 = ny + n.height
          return nx2 > sx && nx < ex && ny2 > sy && ny < ey
        })
        .map((n) => n.id)

      const prior = marqueeRef.current.priorSelection
      const merged = [...new Set([...prior, ...hit])]
      setSelectedNodes(merged)
      return
    }
    onPan(e)
  }, [connectingFrom, marquee, screenToCanvas, onPan, nodes, setSelectedNodes])

  const onCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (connectingFrom) {
      const target = e.target as HTMLElement
      let targetNodeId: string | null = null

      if (target.dataset.handle && target.dataset.nodeId && target.dataset.nodeId !== connectingFrom.nodeId) {
        targetNodeId = target.dataset.nodeId
      } else if (connectHoverNodeId) {
        targetNodeId = connectHoverNodeId
      }

      if (targetNodeId && activeWorkspaceId) {
        addConnection(activeWorkspaceId, connectingFrom.nodeId, targetNodeId)
      }
      setConnectingFrom(null)
      setConnectingTo(null)
      setConnectHoverNodeId(null)
      return
    }
    if (marquee) {
      if (marqueeRef.current) {
        const dx = Math.abs(e.clientX - marqueeRef.current.startScreenX)
        const dy = Math.abs(e.clientY - marqueeRef.current.startScreenY)
        if (dx < 3 && dy < 3 && marqueeRef.current.priorSelection.length === 0) {
          setSelectedNodes([])
        }
      }
      setMarquee(null)
      marqueeRef.current = null
      return
    }
    endPan()
  }, [connectingFrom, connectHoverNodeId, marquee, activeWorkspaceId, addConnection, endPan, setSelectedNodes])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect)
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y })
  }, [screenToCanvas])

  const createWorkspace = useFolderStore((s) => s.createWorkspace)

  const handleAddNode = useCallback(async (type: NodeType) => {
    if (!activeWorkspaceId || !contextMenu) return
    const { canvasX, canvasY } = contextMenu
    setContextMenu(null)

    if (type === 'tab' && activeWorkspace) {
      const ws = await createWorkspace('Embedded Workspace', activeWorkspace.folder_id, activeWorkspaceId)
      addNode(activeWorkspaceId, type, { x: canvasX, y: canvasY }, { target_workspace_id: ws.id, label: ws.name })
    } else {
      addNode(activeWorkspaceId, type, { x: canvasX, y: canvasY })
    }
  }, [activeWorkspaceId, activeWorkspace, contextMenu, addNode, createWorkspace])

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg text-text-secondary">No workspace selected</p>
          <p className="text-sm text-text-muted">Select a workspace from the sidebar or create a new one</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={canvasRef}
      className="h-full w-full overflow-hidden relative bg-bg cursor-default select-none"
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={() => { endPan(); setConnectingFrom(null); setConnectingTo(null); setConnectHoverNodeId(null); setMarquee(null); marqueeRef.current = null }}
      onContextMenu={onContextMenu}
    >
      {/* Dot grid background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <pattern
            id="dot-grid"
            x={viewport.x % (20 * viewport.zoom)}
            y={viewport.y % (20 * viewport.zoom)}
            width={20 * viewport.zoom}
            height={20 * viewport.zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={0.8} fill="var(--color-border)" opacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Transform layer */}
      <div
        data-canvas-bg
        className="absolute origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          zIndex: 1,
        }}
      >
        <ConnectionLayer connections={visibleConnections} nodes={visibleNodes} />

        {/* Active connection line */}
        {connectingFrom && connectingTo && (
          <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
            <line
              x1={connectingFrom.x}
              y1={connectingFrom.y}
              x2={connectingTo.x}
              y2={connectingTo.y}
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeDasharray="6,3"
              opacity={0.5}
            />
          </svg>
        )}

        {visibleNodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            connectTarget={connectHoverNodeId === node.id}
            onDragStart={startDrag}
            onSelect={selectNode}
          />
        ))}
      </div>

      {/* Marquee selection rectangle */}
      {marquee && (
        <div
          className="absolute border border-accent/40 bg-accent/8 rounded-lg pointer-events-none"
          style={{
            left: Math.min(marquee.startX, marquee.endX) * viewport.zoom + viewport.x,
            top: Math.min(marquee.startY, marquee.endY) * viewport.zoom + viewport.y,
            width: Math.abs(marquee.endX - marquee.startX) * viewport.zoom,
            height: Math.abs(marquee.endY - marquee.startY) * viewport.zoom,
            zIndex: 50,
          }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAddNode={handleAddNode}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Minimap */}
      {useLayoutStore.getState().showMinimap && <Minimap
        nodes={nodes}
        viewport={viewport}
        canvasWidth={canvasSize.w}
        canvasHeight={canvasSize.h}
        onRecenter={() => {
          if (nodes.length === 0) {
            setViewport({ x: 0, y: 0, zoom: 1 })
            return
          }
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const n of nodes) {
            minX = Math.min(minX, n.position_x)
            minY = Math.min(minY, n.position_y)
            maxX = Math.max(maxX, n.position_x + n.width)
            maxY = Math.max(maxY, n.position_y + n.height)
          }
          const cx = (minX + maxX) / 2
          const cy = (minY + maxY) / 2
          const pad = 100
          const bw = maxX - minX + pad * 2
          const bh = maxY - minY + pad * 2
          const zoom = Math.min(1, Math.min(canvasSize.w / bw, canvasSize.h / bh))
          setViewport({
            x: canvasSize.w / 2 - cx * zoom,
            y: canvasSize.h / 2 - cy * zoom,
            zoom,
          })
        }}
        onNavigate={(canvasX, canvasY) => {
          setViewport({
            ...viewport,
            x: canvasSize.w / 2 - canvasX * viewport.zoom,
            y: canvasSize.h / 2 - canvasY * viewport.zoom,
          })
        }}
      />}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-0.5 text-xs text-text-muted bg-surface/90 rounded-full border border-border px-1 py-0.5">
        <button
          className="px-2 py-1 hover:bg-bg-hover rounded-full cursor-pointer transition-colors"
          onClick={() => {
            const newZoom = Math.max(0.1, viewport.zoom / 1.2)
            const cx = canvasSize.w / 2
            const cy = canvasSize.h / 2
            setViewport({
              x: cx - (cx - viewport.x) * (newZoom / viewport.zoom),
              y: cy - (cy - viewport.y) * (newZoom / viewport.zoom),
              zoom: newZoom,
            })
          }}
        >
          -
        </button>
        <span className="px-1.5 min-w-[3ch] text-center tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
        <button
          className="px-2 py-1 hover:bg-bg-hover rounded-full cursor-pointer transition-colors"
          onClick={() => {
            const newZoom = Math.min(5, viewport.zoom * 1.2)
            const cx = canvasSize.w / 2
            const cy = canvasSize.h / 2
            setViewport({
              x: cx - (cx - viewport.x) * (newZoom / viewport.zoom),
              y: cy - (cy - viewport.y) * (newZoom / viewport.zoom),
              zoom: newZoom,
            })
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
