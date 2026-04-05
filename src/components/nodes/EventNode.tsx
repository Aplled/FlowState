import { memo, useState } from 'react'
import { Calendar, RefreshCw } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, EventData } from '@/types/database'

interface EventNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const EventNode = memo(function EventNode({ node, selected, connectTarget, onDragStart, onSelect }: EventNodeProps) {
  const data = node.data as unknown as EventData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [title, setTitle] = useState(data.title)

  const patchData = (patch: Partial<EventData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const saveTitle = () => {
    if (title !== data.title) patchData({ title })
  }

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#f472b6"
      icon={<Calendar className="h-3.5 w-3.5" />}
      title={data.title}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            className="flex-1 bg-transparent text-sm font-medium text-text outline-none cursor-text"
          />
          {data.google_event_id && (
            <span title="Synced with Google Calendar" className="text-accent shrink-0">
              <RefreshCw className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="space-y-1 text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Start:</span>
            <input
              type="datetime-local"
              value={data.start_time?.slice(0, 16) ?? ''}
              onChange={(e) => patchData({ start_time: new Date(e.target.value).toISOString() })}
              className="bg-bg-tertiary rounded px-1.5 py-0.5 outline-none cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">End:</span>
            <input
              type="datetime-local"
              value={data.end_time?.slice(0, 16) ?? ''}
              onChange={(e) => patchData({ end_time: new Date(e.target.value).toISOString() })}
              className="bg-bg-tertiary rounded px-1.5 py-0.5 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </BaseNode>
  )
})
