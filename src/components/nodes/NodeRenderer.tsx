import { memo } from 'react'
import type { FlowNode } from '@/types/database'
import { TaskNode } from './TaskNode'
import { NoteNode } from './NoteNode'
import { DocNode } from './DocNode'
import { TableNode } from './TableNode'
import { EventNode } from './EventNode'
import { BrowserNode } from './BrowserNode'
import { DrawNode } from './DrawNode'
import { TabNode } from './TabNode'
import { GroupleNode } from './GroupleNode'

interface NodeRendererProps {
  node: FlowNode
  selected: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const NodeRenderer = memo(function NodeRenderer(props: NodeRendererProps) {
  switch (props.node.type) {
    case 'task': return <TaskNode {...props} />
    case 'note': return <NoteNode {...props} />
    case 'doc': return <DocNode {...props} />
    case 'table': return <TableNode {...props} />
    case 'event': return <EventNode {...props} />
    case 'browser': return <BrowserNode {...props} />
    case 'draw': return <DrawNode {...props} />
    case 'tab': return <TabNode {...props} />
    case 'grouple': return <GroupleNode {...props} />
    default: return null
  }
})
