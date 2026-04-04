import { useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, EventData } from '@/types/database'

export function EventNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as EventData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [title, setTitle] = useState(data.title)
  const [desc, setDesc] = useState(data.description ?? '')

  const patchData = (patch: Partial<EventData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  return (
    <div className="p-6 space-y-5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== data.title) patchData({ title }) }}
        className="w-full text-xl font-bold bg-transparent text-text outline-none"
        placeholder="Event title"
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Start</label>
          <input
            type="datetime-local"
            value={data.start_time?.slice(0, 16) ?? ''}
            onChange={(e) => patchData({ start_time: new Date(e.target.value).toISOString() })}
            className="block w-full bg-bg-tertiary rounded px-2 py-1.5 text-sm text-text outline-none cursor-pointer"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">End</label>
          <input
            type="datetime-local"
            value={data.end_time?.slice(0, 16) ?? ''}
            onChange={(e) => patchData({ end_time: new Date(e.target.value).toISOString() })}
            className="block w-full bg-bg-tertiary rounded px-2 py-1.5 text-sm text-text outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
          <input
            type="checkbox"
            checked={data.all_day}
            onChange={(e) => patchData({ all_day: e.target.checked })}
            className="accent-accent"
          />
          All day
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase text-text-muted font-medium">Location</label>
        <input
          value={data.location ?? ''}
          onChange={(e) => patchData({ location: e.target.value })}
          placeholder="Add location..."
          className="w-full bg-bg-tertiary rounded px-2 py-1.5 text-sm text-text outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase text-text-muted font-medium">Description</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => { if (desc !== (data.description ?? '')) patchData({ description: desc }) }}
          placeholder="Add a description..."
          className="w-full min-h-[150px] bg-bg-tertiary rounded-lg p-3 text-sm text-text placeholder:text-text-muted outline-none resize-none"
        />
      </div>
    </div>
  )
}
