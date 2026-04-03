import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { FileText } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { DocData } from '@/types/database'

export const DocNode = memo(function DocNode(props: NodeProps) {
  const data = props.data as unknown as DocData & { _dbNode: unknown }
  const updateNode = useNodeStore((s) => s.updateNode)
  const [title, setTitle] = useState(data.title ?? 'Untitled')
  const [content, setContent] = useState(data.content ?? '')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const save = (updates: Partial<DocData>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(props.id, { data: { ...data, _dbNode: undefined, ...updates } })
    }, 500)
  }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-doc)"
      icon={<FileText className="h-3.5 w-3.5" />}
      title={title}
    >
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value }) }}
          className="w-full bg-transparent text-sm font-semibold text-text outline-none"
          placeholder="Document title"
        />
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); save({ content: e.target.value }) }}
          placeholder="Start writing..."
          className="min-h-[120px] w-full resize-none bg-transparent text-sm text-text-secondary placeholder-text-muted outline-none leading-relaxed"
        />
      </div>
    </BaseNode>
  )
})
