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

  return (
    <div className="h-full flex flex-col bg-bg overflow-auto">
      {content}
    </div>
  )
}
