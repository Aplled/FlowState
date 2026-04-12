import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
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
          <Select
            value={data.status}
            onChange={(v) => patchData({ status: v as TaskData['status'] })}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Priority</label>
          <Select
            value={data.priority}
            onChange={(v) => patchData({ priority: v as TaskData['priority'] })}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-text-muted font-medium">Due Date</label>
          <DatePicker
            value={data.due_date}
            onChange={(v) => patchData({ due_date: v })}
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
