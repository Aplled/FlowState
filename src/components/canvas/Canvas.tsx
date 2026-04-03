import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type OnConnect,
  type Connection,
} from '@xyflow/react'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { nodeTypes } from '@/components/nodes'
import { CanvasContextMenu } from './CanvasContextMenu'
import type { NodeType } from '@/types/database'

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, setApplyFns, fetchNodes, fetchConnections, addConnection, addNode } = useNodeStore()
  const activeWorkspaceId = useFolderStore((s) => s.activeWorkspaceId)
  const updateWorkspace = useFolderStore((s) => s.updateWorkspace)
  const { screenToFlowPosition } = useReactFlow()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPos: { x: number; y: number } } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Register the apply functions
  useEffect(() => {
    setApplyFns(applyNodeChanges, applyEdgeChanges)
  }, [setApplyFns])

  // Load nodes when workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchNodes(activeWorkspaceId)
      fetchConnections(activeWorkspaceId)
    }
  }, [activeWorkspaceId, fetchNodes, fetchConnections])

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (activeWorkspaceId && connection.source && connection.target) {
        addConnection(activeWorkspaceId, connection.source, connection.target)
      }
    },
    [activeWorkspaceId, addConnection]
  )

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setContextMenu({ x: event.clientX, y: event.clientY, flowPos })
    },
    [screenToFlowPosition]
  )

  const handleAddNode = useCallback(
    async (type: NodeType) => {
      if (!activeWorkspaceId || !contextMenu) return
      await addNode(activeWorkspaceId, type, contextMenu.flowPos)
      setContextMenu(null)
    },
    [activeWorkspaceId, contextMenu, addNode]
  )

  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (activeWorkspaceId) {
        updateWorkspace(activeWorkspaceId, {
          viewport_x: viewport.x,
          viewport_y: viewport.y,
          viewport_zoom: viewport.zoom,
        })
      }
    },
    [activeWorkspaceId, updateWorkspace]
  )

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
    <div ref={wrapperRef} className="h-full w-full" onClick={() => setContextMenu(null)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onContextMenu={onContextMenu}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: 'var(--color-accent)', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#2a2a3a" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            const colors: Record<string, string> = {
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
            return colors[node.type ?? ''] ?? '#6366f1'
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAddNode={handleAddNode}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
