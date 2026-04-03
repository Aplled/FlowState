import type { NodeTypes } from '@xyflow/react'
import { TaskNode } from './TaskNode'
import { NoteNode } from './NoteNode'
import { DocNode } from './DocNode'
import { EventNode } from './EventNode'
import { TableNode } from './TableNode'
import { BrowserNode } from './BrowserNode'
import { DrawNode } from './DrawNode'
import { TabNode } from './TabNode'
import { GroupleNode } from './GroupleNode'

export const nodeTypes: NodeTypes = {
  task: TaskNode,
  note: NoteNode,
  doc: DocNode,
  event: EventNode,
  table: TableNode,
  browser: BrowserNode,
  draw: DrawNode,
  tab: TabNode,
  grouple: GroupleNode,
}
