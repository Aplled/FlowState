import { useCallback, useEffect, useRef, useState } from 'react'

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

interface UseCanvasOptions {
  initialViewport?: ViewportState
  minZoom?: number
  maxZoom?: number
  onViewportChange?: (viewport: ViewportState) => void
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const {
    initialViewport = { x: 0, y: 0, zoom: 1 },
    minZoom = 0.1,
    maxZoom = 4,
    onViewportChange,
  } = options

  const [viewport, setViewportState] = useState<ViewportState>(initialViewport)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const setViewport = useCallback((vp: ViewportState) => {
    setViewportState(vp)
    onViewportChange?.(vp)
  }, [onViewportChange])

  /** Convert screen coords → canvas coords */
  const screenToCanvas = useCallback((screenX: number, screenY: number, rect: DOMRect) => {
    const vp = viewportRef.current
    return {
      x: (screenX - rect.left - vp.x) / vp.zoom,
      y: (screenY - rect.top - vp.y) / vp.zoom,
    }
  }, [])

  /** Start panning (middle-click or space+drag) */
  const startPan = useCallback((e: React.MouseEvent) => {
    isPanning.current = true
    panStart.current = { x: e.clientX - viewportRef.current.x, y: e.clientY - viewportRef.current.y }
  }, [])

  const onPan = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const newX = e.clientX - panStart.current.x
    const newY = e.clientY - panStart.current.y
    setViewport({ ...viewportRef.current, x: newX, y: newY })
  }, [setViewport])

  const endPan = useCallback(() => {
    isPanning.current = false
  }, [])

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const vp = viewportRef.current

    // Two-finger scroll pans. Shift+vertical scroll or pinch (ctrlKey) zooms
    // toward the cursor.
    const lineScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1
    const dy = e.deltaY * lineScale
    const dx = e.deltaX * lineScale

    if (!e.shiftKey) {
      if (dx !== 0 || dy !== 0) {
        setViewport({ ...vp, x: vp.x - dx, y: vp.y - dy })
      }
      return
    }

    if (dy !== 0) {
      const factor = Math.exp(-dy * 0.004)
      const current = viewportRef.current
      const newZoom = Math.min(maxZoom, Math.max(minZoom, current.zoom * factor))
      if (newZoom === current.zoom) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const newX = mx - (mx - current.x) * (newZoom / current.zoom)
      const newY = my - (my - current.y) * (newZoom / current.zoom)
      setViewport({ x: newX, y: newY, zoom: newZoom })
    }
  }, [setViewport, minZoom, maxZoom])

  return {
    viewport,
    setViewport,
    screenToCanvas,
    isPanning,
    startPan,
    onPan,
    endPan,
    onWheel,
  }
}
