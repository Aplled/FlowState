import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, Lock, LogIn, RefreshCw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, BrowserData } from '@/types/database'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export function BrowserNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as BrowserData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [url, setUrl] = useState(data.url || '')
  const [editing, setEditing] = useState(false)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const label = `browser-embed-${node.id}`
  const pinnedHost = hostOf(data.url)

  // Mount / unmount the native child webview pinned to the expanded area.
  useEffect(() => {
    if (!isTauri || !data.url || !pinnedHost) return

    let cancelled = false
    let lastBounds = { x: -1, y: -1, w: -1, h: -1 }
    let rafId = 0
    let created = false

    const syncBounds = async () => {
      const el = placeholderRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = Math.ceil(r.left)
      const y = Math.ceil(r.top)
      const w = Math.max(0, Math.floor(r.right) - x)
      const h = Math.max(0, Math.floor(r.bottom) - y)
      if (w <= 0 || h <= 0) return
      if (x === lastBounds.x && y === lastBounds.y && w === lastBounds.w && h === lastBounds.h) return
      lastBounds = { x, y, w, h }
      if (!created) {
        created = true
        try {
          await invoke('browser_embed_create', {
            label, url: data.url,
            x, y, width: w, height: h,
          })
        } catch (e) {
          console.error('browser_embed_create failed', e)
          created = false
        }
      } else {
        try {
          await invoke('browser_embed_set_bounds', { label, x, y, width: w, height: h })
        } catch (e) {
          console.error('browser_embed_set_bounds failed', e)
        }
      }
    }

    const tick = () => {
      if (cancelled) return
      syncBounds()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      invoke('browser_embed_close', { label }).catch(() => {})
    }
  }, [data.url, pinnedHost, label])

  const navigate = () => {
    let normalized = url.trim()
    if (!normalized) return
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    setUrl(normalized)
    setEditing(false)
    updateNode(node.id, { data: { ...data, url: normalized } as unknown as FlowNode['data'] })
  }

  const popOut = () => {
    if (!data.url) return
    invoke('browser_open_standalone', { url: data.url }).catch((e) =>
      console.error('browser_open_standalone failed', e)
    )
  }

  const signInWithGoogle = () => {
    invoke('browser_open_standalone', {
      url: 'https://accounts.google.com/ServiceLogin?hl=en',
    }).catch((e) => console.error('browser_open_standalone failed', e))
  }

  const reload = () => {
    if (!data.url) return
    invoke('browser_embed_navigate', { label, url: data.url }).catch((e) =>
      console.error('browser_embed_navigate failed', e)
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Lock className="h-3.5 w-3.5 text-text-muted shrink-0" />
        {editing ? (
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate()
              if (e.key === 'Escape') { setUrl(data.url || ''); setEditing(false) }
            }}
            onBlur={navigate}
            placeholder="https://..."
            className="flex-1 bg-bg-tertiary rounded px-3 py-1.5 text-sm text-text outline-none ring-1 ring-border focus:ring-accent cursor-text"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 bg-bg-tertiary rounded px-3 py-1.5 text-sm text-text text-left hover:ring-1 hover:ring-border cursor-text truncate"
            title="Click to change pinned URL"
          >
            <span className="text-text-muted mr-2">{pinnedHost || 'unset'}</span>
            <span className="text-text-secondary truncate">{data.url}</span>
          </button>
        )}
        {editing && (
          <button onClick={navigate} className="rounded bg-accent/20 p-1.5 text-accent hover:bg-accent/30 cursor-pointer">
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={signInWithGoogle}
          className="text-text-muted hover:text-text p-1.5 cursor-pointer"
          title="Sign in with Google (opens a standalone window; cookies persist back into this view)"
        >
          <LogIn className="h-4 w-4" />
        </button>
        {data.url && (
          <>
            <button
              onClick={reload}
              className="text-text-muted hover:text-text p-1.5 cursor-pointer"
              title="Reload"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={popOut}
              className="text-text-muted hover:text-text p-1.5 cursor-pointer"
              title="Open in standalone window"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="flex-1 relative bg-bg-secondary">
        {data.url && <div ref={placeholderRef} className="absolute inset-0" />}
        {!isTauri && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-text-muted px-4 text-center">
            Embedded browser requires the desktop app.
          </div>
        )}
      </div>
    </div>
  )
}
