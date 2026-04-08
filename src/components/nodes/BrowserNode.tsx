import { memo, useState, useEffect } from 'react'
import { Globe, ExternalLink, Loader2 } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { supabase } from '@/lib/supabase'
import type { FlowNode, BrowserData } from '@/types/database'

interface BrowserNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

const previewCache = new Map<string, LinkPreview>()

export const BrowserNode = memo(function BrowserNode({ node, selected, connectTarget, onDragStart, onSelect }: BrowserNodeProps) {
  const data = node.data as unknown as BrowserData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [editing, setEditing] = useState(!data.url)
  const [urlInput, setUrlInput] = useState(data.url || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(data.title || '')
  const [preview, setPreview] = useState<LinkPreview | null>(data.url ? previewCache.get(data.url) ?? null : null)
  const [loading, setLoading] = useState(false)

  const hostname = (() => {
    try { return new URL(data.url).hostname } catch { return '' }
  })()

  // Fetch preview when URL changes
  useEffect(() => {
    if (!data.url) return
    if (previewCache.has(data.url)) {
      setPreview(previewCache.get(data.url)!)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase.functions.invoke('link-preview', { body: { url: data.url } })
      .then(({ data: result, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !result) return
        previewCache.set(data.url, result)
        setPreview(result)
        // Auto-set title only if user hasn't manually set one
        if (result.title && !data.title) {
          updateNode(node.id, { data: { ...data, title: result.title } as unknown as FlowNode['data'] })
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [data.url])

  const submitUrl = () => {
    if (!urlInput.trim()) return
    let normalized = urlInput.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    setUrlInput(normalized)
    setEditing(false)
    updateNode(node.id, { data: { ...data, url: normalized } as unknown as FlowNode['data'] })
  }

  const displayTitle = preview?.title || data.title || 'Browser'

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#6366f1"
      icon={<Globe className="h-3.5 w-3.5" />}
      title={displayTitle}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        {/* Editable title */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={() => {
              setEditingTitle(false)
              if (titleInput !== data.title) updateNode(node.id, { data: { ...data, title: titleInput } as unknown as FlowNode['data'] })
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitleInput(data.title || ''); setEditingTitle(false) } }}
            className="w-full bg-bg-tertiary rounded px-2 py-1 text-xs font-medium text-text outline-none ring-1 ring-border focus:ring-accent cursor-text"
          />
        ) : (
          <p
            className="text-xs font-medium text-text cursor-text truncate hover:bg-bg-tertiary/50 rounded px-1 -mx-1 transition"
            onClick={() => { setTitleInput(data.title || preview?.title || ''); setEditingTitle(true) }}
          >
            {data.title || preview?.title || 'Untitled'}
          </p>
        )}

        {/* URL input (shown when editing or no URL set) */}
        {editing || !data.url ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape' && data.url) setEditing(false) }}
              onBlur={() => { if (urlInput.trim()) submitUrl(); else if (data.url) setEditing(false) }}
              placeholder="Paste a URL..."
              className="flex-1 bg-bg-tertiary rounded px-2 py-1 text-xs text-text outline-none ring-1 ring-border focus:ring-accent cursor-text"
            />
          </div>
        ) : (
          /* Preview card */
          <div
            className="rounded-lg border border-border overflow-hidden cursor-pointer hover:border-accent/40 transition-colors"
            style={{ borderLeft: '3px solid #6366f1' }}
            onClick={() => window.open(data.url, '_blank', 'noopener,noreferrer')}
          >
            {/* Site name + title */}
            <div className="px-2.5 py-2 space-y-0.5 bg-bg-secondary">
              <div className="flex items-center gap-1.5">
                {hostname && (
                  <img
                    src={preview?.favicon || `https://icons.duckduckgo.com/ip3/${hostname}.ico`}
                    alt=""
                    className="w-4 h-4 rounded-sm shrink-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      const ddg = `https://icons.duckduckgo.com/ip3/${hostname}.ico`
                      if (img.src !== ddg && !img.src.includes('duckduckgo')) {
                        img.src = ddg
                      } else {
                        img.style.display = 'none'
                      }
                    }}
                  />
                )}
                <span className="text-[10px] text-text-muted truncate">
                  {preview?.siteName || hostname}
                </span>
                {loading && <Loader2 className="h-3 w-3 text-text-muted animate-spin ml-auto shrink-0" />}
                <ExternalLink className="h-3 w-3 text-text-muted ml-auto shrink-0" />
              </div>
              <p className="text-xs font-medium text-accent leading-tight line-clamp-2">
                {preview?.title || hostname}
              </p>
              {preview?.description && (
                <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                  {preview.description}
                </p>
              )}
            </div>

            {/* OG Image */}
            {preview?.image && (
              <div className="w-full bg-bg-tertiary">
                <img
                  src={preview.image}
                  alt=""
                  className="w-full object-cover"
                  style={{ maxHeight: Math.max(node.height - 130, 80) }}
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Click URL to edit */}
        {data.url && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            className="text-[10px] text-text-muted hover:text-accent truncate block w-full text-left cursor-pointer"
          >
            {data.url}
          </button>
        )}
      </div>
    </BaseNode>
  )
})
