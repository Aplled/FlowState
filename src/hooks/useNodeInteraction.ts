import { useCallback, useRef } from 'react'
import type { ViewportState } from './useCanvas'

interface UseNodeInteractionOptions {
  viewport: ViewportState
  onNodeMove: (id: string, x: number, y: number) => void
  onNodeMoveEnd: (id: string, x: number, y: number) => void
  onSelectionChange: (ids: string[]) => void
  selectedIds: string[]
  /** Map of nodeId → { x, y } for all nodes, needed for multi-drag */
  nodePositions: Map<string, { x: number; y: number }>
}

export function useNodeInteraction({
  viewport,
  onNodeMove,
  onNodeMoveEnd,
  onSelectionChange,
  selectedIds,
  nodePositions,
}: UseNodeInteractionOptions) {
  const dragging = useRef<{
    ids: string[]
    startX: number
    startY: number
    origins: Map<string, { x: number; y: number }>
  } | null>(null)
  const didDrag = useRef(false)

  const startDrag = useCallback((e: React.MouseEvent, nodeId: string, nodeX: number, nodeY: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    didDrag.current = false

    // If the dragged node is already selected, drag all selected nodes.
    // Otherwise drag only this node (selection updates on mouseUp).
    const ids = selectedIds.includes(nodeId) ? [...selectedIds] : [nodeId]
    const origins = new Map<string, { x: number; y: number }>()
    for (const id of ids) {
      const pos = id === nodeId ? { x: nodeX, y: nodeY } : nodePositions.get(id)
      if (pos) origins.set(id, { x: pos.x, y: pos.y })
    }

    dragging.current = { ids, startX: e.clientX, startY: e.clientY, origins }

    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return
      const dx = (me.clientX - dragging.current.startX) / viewport.zoom
      const dy = (me.clientY - dragging.current.startY) / viewport.zoom
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true
      for (const [id, origin] of dragging.current.origins) {
        onNodeMove(id, origin.x + dx, origin.y + dy)
      }
    }

    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragging.current && didDrag.current) {
        const dx = (me.clientX - dragging.current.startX) / viewport.zoom
        const dy = (me.clientY - dragging.current.startY) / viewport.zoom
        for (const [id, origin] of dragging.current.origins) {
          onNodeMoveEnd(id, origin.x + dx, origin.y + dy)
        }
      }
      dragging.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [viewport.zoom, onNodeMove, onNodeMoveEnd, selectedIds, nodePositions])

  const selectNode = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (didDrag.current) return

    if (e.shiftKey || e.metaKey) {
      if (selectedIds.includes(nodeId)) {
        onSelectionChange(selectedIds.filter((id) => id !== nodeId))
      } else {
        onSelectionChange([...selectedIds, nodeId])
      }
    } else {
      onSelectionChange([nodeId])
    }
  }, [selectedIds, onSelectionChange])

  return { startDrag, selectNode, isDragging: () => dragging.current !== null }
}
