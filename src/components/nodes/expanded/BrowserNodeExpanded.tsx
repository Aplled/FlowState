import { useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, BrowserData } from '@/types/database'

export function BrowserNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as BrowserData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [url, setUrl] = useState(data.url)

  const navigate = () => {
    let normalizedUrl = url
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`
      setUrl(normalizedUrl)
    }
    updateNode(node.id, { data: { ...data, url: normalizedUrl } as unknown as FlowNode['data'] })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate() }}
          placeholder="https://..."
          className="flex-1 bg-bg-tertiary rounded px-3 py-1.5 text-sm text-text outline-none ring-1 ring-border focus:ring-accent cursor-text"
        />
        <button onClick={navigate} className="rounded bg-accent/20 p-1.5 text-accent hover:bg-accent/30 cursor-pointer">
          <ArrowRight className="h-4 w-4" />
        </button>
        {data.url && (
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text p-1.5">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      <div className="flex-1">
        <iframe
          src={data.url}
          title="Browser"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  )
}
