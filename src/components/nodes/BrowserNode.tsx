import { memo, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Globe, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { BrowserData } from '@/types/database'

export const BrowserNode = memo(function BrowserNode(props: NodeProps) {
  const data = props.data as unknown as BrowserData & { _dbNode: unknown }
  const updateNode = useNodeStore((s) => s.updateNode)
  const [url, setUrl] = useState(data.url ?? 'https://www.google.com')
  const [iframeKey, setIframeKey] = useState(0)

  const navigate = (newUrl: string) => {
    setUrl(newUrl)
    updateNode(props.id, { data: { ...data, _dbNode: undefined, url: newUrl } })
    setIframeKey((k) => k + 1)
  }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-browser)"
      icon={<Globe className="h-3.5 w-3.5" />}
      title={data.title || 'Browser'}
    >
      <div className="space-y-2">
        {/* URL bar */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-secondary px-2 py-1">
          <button className="text-text-muted hover:text-text">
            <ArrowLeft className="h-3 w-3" />
          </button>
          <button className="text-text-muted hover:text-text">
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="text-text-muted hover:text-text"
          >
            <RotateCw className="h-3 w-3" />
          </button>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(url)}
            className="flex-1 bg-transparent text-xs text-text outline-none"
            placeholder="Enter URL..."
          />
        </div>

        {/* Iframe */}
        <div className="overflow-hidden rounded border border-border" style={{ height: 280 }}>
          <iframe
            key={iframeKey}
            src={url}
            title="Browser"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </BaseNode>
  )
})
