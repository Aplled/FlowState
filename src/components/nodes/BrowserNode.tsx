import { memo, useState } from 'react'
import { Globe, ArrowRight } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, BrowserData } from '@/types/database'

interface BrowserNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const BrowserNode = memo(function BrowserNode({ node, selected, connectTarget, onDragStart, onSelect }: BrowserNodeProps) {
  const data = node.data as unknown as BrowserData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [url, setUrl] = useState(data.url)

  const navigate = () => {
    let normalizedUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`
      setUrl(normalizedUrl)
    }
    updateNode(node.id, { data: { ...data, url: normalizedUrl } as unknown as FlowNode['data'] })
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#6366f1"
      icon={<Globe className="h-3.5 w-3.5" />}
      title={data.title || 'Browser'}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate() }}
            placeholder="https://..."
            className="flex-1 bg-bg-tertiary rounded px-2 py-1 text-xs text-text outline-none ring-1 ring-border focus:ring-accent cursor-text"
          />
          <button
            onClick={navigate}
            className="rounded bg-accent/20 p-1 text-accent hover:bg-accent/30 cursor-pointer"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="rounded border border-border bg-bg-secondary overflow-hidden" style={{ height: node.height - 100 }}>
          <iframe
            src={data.url}
            title="Browser"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </BaseNode>
  )
})
