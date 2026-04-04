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

    // Pinch-zoom or ctrl+scroll
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      const newZoom = Math.min(maxZoom, Math.max(minZoom, vp.zoom * factor))
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const newX = mx - (mx - vp.x) * (newZoom / vp.zoom)
      const newY = my - (my - vp.y) * (newZoom / vp.zoom)
      setViewport({ x: newX, y: newY, zoom: newZoom })
    } else {
      // Plain scroll → pan
      setViewport({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY })
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
