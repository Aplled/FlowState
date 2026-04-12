import { useCallback, useRef } from 'react'
import type { ViewportState } from './useCanvas'

interface NodeInfo {
  x: number
  y: number
  width: number
  height: number
  type: string
}

interface UseNodeInteractionOptions {
  viewport: ViewportState
  onNodeMove: (id: string, x: number, y: number) => void
  onNodeMoveEnd: (id: string, x: number, y: number) => void
  onSelectionChange: (ids: string[]) => void
  selectedIds: string[]
  /** Map of nodeId → position/size for all nodes, needed for multi-drag and drop-on-group */
  nodePositions: Map<string, NodeInfo>
  onDropOnGroup?: (draggedId: string, groupId: string) => void
}

export function useNodeInteraction({
  viewport,
  onNodeMove,
  onNodeMoveEnd,
  onSelectionChange,
  selectedIds,
  nodePositions,
  onDropOnGroup,
}: UseNodeInteractionOptions) {
  const dragging = useRef<{
    ids: string[]
    startX: number
    startY: number
    origins: Map<string, { x: number; y: number }>
  } | null>(null)
  const didDrag = useRef(false)
  // When a cmd/shift click on an already-selected node fires, the mouseup
  // handler should deselect it — but only if startDrag didn't *just* add it.
  const justAddedByModifier = useRef(false)

  const startDrag = useCallback((e: React.MouseEvent, nodeId: string, nodeX: number, nodeY: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    didDrag.current = false

    // Selection behaviour on mousedown:
    //  - Already selected → drag the whole selection (no change).
    //  - Cmd/Shift held   → add this node to the selection and drag the group.
    //  - Plain click      → replace selection with just this node.
    const alreadySelected = selectedIds.includes(nodeId)
    const additive = e.shiftKey || e.metaKey
    justAddedByModifier.current = false
    let ids: string[]
    if (alreadySelected) {
      ids = [...selectedIds]
    } else if (additive) {
      ids = [...selectedIds, nodeId]
      justAddedByModifier.current = true
      onSelectionChange(ids)
    } else {
      ids = [nodeId]
      onSelectionChange(ids)
    }
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
        // Check if single dragged node landed on a group node
        if (onDropOnGroup && dragging.current.ids.length === 1) {
          const draggedId = dragging.current.ids[0]
          const draggedOrigin = dragging.current.origins.get(draggedId)
          const draggedInfo = nodePositions.get(draggedId)
          if (draggedOrigin && draggedInfo) {
            const cx = draggedOrigin.x + dx + draggedInfo.width / 2
            const cy = draggedOrigin.y + dy + draggedInfo.height / 2
            for (const [nid, info] of nodePositions) {
              if (nid === draggedId) continue
              if (info.type !== 'grouple') continue
              if (
                cx >= info.x && cx <= info.x + info.width &&
                cy >= info.y && cy <= info.y + info.height
              ) {
                onDropOnGroup(draggedId, nid)
                break
              }
            }
          }
        }
      }
      dragging.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [viewport.zoom, onNodeMove, onNodeMoveEnd, selectedIds, nodePositions])

  const selectNode = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (didDrag.current) return

    // startDrag (mousedown) already handled the "add to selection" case,
    // so on a modifier-click mouseup we only need to toggle OFF a node
    // that was previously already selected — not one we just added.
    if (e.shiftKey || e.metaKey) {
      if (!justAddedByModifier.current && selectedIds.includes(nodeId)) {
        onSelectionChange(selectedIds.filter((id) => id !== nodeId))
      }
      justAddedByModifier.current = false
    } else {
      onSelectionChange([nodeId])
    }
  }, [selectedIds, onSelectionChange])

  return { startDrag, selectNode, isDragging: () => dragging.current !== null }
}
