import { useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, GroupleData } from '@/types/database'

const COLOR_OPTIONS = ['#6366f1', '#f59e0b', '#22c55e', '#3b82f6', '#f472b6', '#ef4444', '#14b8a6', '#a78bfa']

export function GroupleNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as GroupleData
  const updateNode = useNodeStore((s) => s.updateNode)
  const nodes = useNodeStore((s) => s.nodes)
  const setParent = useNodeStore((s) => s.setParent)
  const [label, setLabel] = useState(data.label)

  const patchData = (patch: Partial<GroupleData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const childNodes = nodes.filter((n) => n.parent_id === node.id)

  return (
    <div className="p-6 space-y-5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label !== data.label) patchData({ label }) }}
        className="w-full text-xl font-bold bg-transparent text-text outline-none"
        placeholder="Group name"
      />

      <div className="space-y-2">
        <label className="text-[10px] uppercase text-text-muted font-medium">Color</label>
        <div className="flex items-center gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => patchData({ color: c })}
              className="h-6 w-6 rounded-full border-2 cursor-pointer transition hover:scale-110"
              style={{ background: c, borderColor: c === data.color ? '#fff' : 'transparent' }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase text-text-muted font-medium">
          Members ({childNodes.length})
        </label>
        {childNodes.length === 0 ? (
          <p className="text-sm text-text-muted">No nodes in this group. Drag nodes onto the group on the canvas.</p>
        ) : (
          <div className="space-y-1">
            {childNodes.map((n) => (
              <div key={n.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-tertiary text-sm text-text">
                <span className="capitalize text-text-muted text-xs">{n.type}</span>
                <span className="truncate flex-1">{(n.data as any)?.title || (n.data as any)?.label || n.type}</span>
                <button
                  onClick={() => setParent(n.id, null)}
                  className="text-[10px] text-text-muted hover:text-red-400 cursor-pointer"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
