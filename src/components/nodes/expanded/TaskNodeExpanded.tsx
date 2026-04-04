import { useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, TaskData } from '@/types/database'

const STATUS_OPTIONS: TaskData['status'][] = ['todo', 'in_progress', 'done']
const PRIORITY_OPTIONS: TaskData['priority'][] = ['none', 'low', 'medium', 'high', 'urgent']

export function TaskNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as TaskData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [title, setTitle] = useState(data.title)
  const [desc, setDesc] = useState(data.description ?? '')

  const patchData = (patch: Partial<TaskData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-8 space-y-6">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== data.title) patchData({ title }) }}
        className="w-full text-2xl font-bold bg-transparent text-text outline-none"
        placeholder="Task title"
      />

      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Status</label>
          <select
            value={data.status}
            onChange={(e) => patchData({ status: e.target.value as TaskData['status'] })}
            className="block bg-bg-tertiary rounded px-2 py-1 text-sm text-text outline-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Priority</label>
          <select
            value={data.priority}
            onChange={(e) => patchData({ priority: e.target.value as TaskData['priority'] })}
            className="block bg-bg-tertiary rounded px-2 py-1 text-sm text-text outline-none cursor-pointer"
          >
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Due Date</label>
          <input
            type="date"
            value={data.due_date?.slice(0, 10) ?? ''}
            onChange={(e) => patchData({ due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
            className="block bg-bg-tertiary rounded px-2 py-1 text-sm text-text outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase text-text-muted font-medium">Description</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => { if (desc !== (data.description ?? '')) patchData({ description: desc }) }}
          placeholder="Add a description..."
          className="w-full min-h-[200px] bg-bg-tertiary rounded-lg p-3 text-sm text-text placeholder:text-text-muted outline-none resize-none"
        />
      </div>
    </div>
  )
}
