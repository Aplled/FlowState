import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { StickyNote } from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import type { NoteData } from '@/types/database'

export const NoteNode = memo(function NoteNode(props: NodeProps) {
  const data = props.data as unknown as NoteData & { _dbNode: unknown }
  const updateNode = useNodeStore((s) => s.updateNode)
  const [content, setContent] = useState(data.content ?? '')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleChange = (value: string) => {
    setContent(value)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(props.id, { data: { ...data, _dbNode: undefined, content: value } })
    }, 500)
  }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-note)"
      icon={<StickyNote className="h-3.5 w-3.5" />}
      title="Note"
    >
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Write something..."
        className="min-h-[80px] w-full resize-none bg-transparent text-sm text-text placeholder-text-muted outline-none"
      />
    </BaseNode>
  )
})
