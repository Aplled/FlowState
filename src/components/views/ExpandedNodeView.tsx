import { useNodeStore } from '@/stores/node-store'
import { TaskNodeExpanded } from '@/components/nodes/expanded/TaskNodeExpanded'
import { NoteNodeExpanded } from '@/components/nodes/expanded/NoteNodeExpanded'
import { DocNodeExpanded } from '@/components/nodes/expanded/DocNodeExpanded'
import { DrawNodeExpanded } from '@/components/nodes/expanded/DrawNodeExpanded'
import { EventNodeExpanded } from '@/components/nodes/expanded/EventNodeExpanded'
import { TableNodeExpanded } from '@/components/nodes/expanded/TableNodeExpanded'
import { BrowserNodeExpanded } from '@/components/nodes/expanded/BrowserNodeExpanded'
import { GroupleNodeExpanded } from '@/components/nodes/expanded/GroupleNodeExpanded'
import { TabNodeExpanded } from '@/components/nodes/expanded/TabNodeExpanded'
import { exportNodeAsMarkdown, exportNodeAsImage, downloadFile } from '@/lib/export'
import { Download, Image } from 'lucide-react'

interface ExpandedNodeContentProps {
  nodeId: string
}

export function ExpandedNodeContent({ nodeId }: ExpandedNodeContentProps) {
  const node = useNodeStore((s) => s.allNodes.find((n) => n.id === nodeId))

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        Node not found
      </div>
    )
  }

  const handleExportMarkdown = () => {
    const md = exportNodeAsMarkdown(node)
    downloadFile(md, `${node.type}-${node.id.slice(0, 6)}.md`, 'text/markdown')
  }

  const handleExportImage = async () => {
    if (node.type === 'draw') {
      const blob = await exportNodeAsImage(node)
      downloadFile(blob, 'drawing.png', 'image/png')
    }
  }

  const content = (() => {
    switch (node.type) {
      case 'task': return <TaskNodeExpanded node={node} />
      case 'note': return <NoteNodeExpanded node={node} />
      case 'doc': return <DocNodeExpanded node={node} />
      case 'draw': return <DrawNodeExpanded node={node} />
      case 'event': return <EventNodeExpanded node={node} />
      case 'table': return <TableNodeExpanded node={node} />
      case 'browser': return <BrowserNodeExpanded node={node} />
      case 'grouple': return <GroupleNodeExpanded node={node} />
      case 'tab': return <TabNodeExpanded node={node} />
      default: return <div className="text-text-muted p-8">Expanded view not available for this node type</div>
    }
  })()

  // Draw node has its own export button in the toolbar
  const showExportHeader = node.type !== 'draw'

  return (
    <div className="h-full flex flex-col bg-bg overflow-auto">
      {showExportHeader && (
        <div className="flex items-center justify-end gap-1 px-4 py-1.5 border-b border-border shrink-0">
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer"
            title="Export as Markdown"
          >
            <Download className="h-3.5 w-3.5" />
            Markdown
          </button>
          {node.type === 'draw' && (
            <button
              onClick={handleExportImage}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer"
              title="Export as Image"
            >
              <Image className="h-3.5 w-3.5" />
              PNG
            </button>
          )}
        </div>
      )}
      {content}
    </div>
  )
}
