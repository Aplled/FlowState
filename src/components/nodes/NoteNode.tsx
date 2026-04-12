import { memo, useState, useRef, useEffect } from 'react'
import { StickyNote } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { useLayoutStore } from '@/stores/layout-store'
import type { FlowNode, NoteData } from '@/types/database'

interface NoteNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const NoteNode = memo(function NoteNode({ node, selected, connectTarget, onDragStart, onSelect }: NoteNodeProps) {
  const data = node.data as unknown as NoteData & { title?: string }
  const updateNode = useNodeStore((s) => s.updateNode)
  const compact = useLayoutStore((s) => s.compactNodeHeaders)
  const [content, setContent] = useState(data.content)
  const [title, setTitle] = useState(data.title ?? '')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (content === data.content && title === (data.title ?? '')) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(node.id, { data: { ...data, content, title } as unknown as FlowNode['data'] })
    }, 500)
    return () => clearTimeout(timeoutRef.current)
  }, [content, title, data.content, data.title, node.id, updateNode])

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#9a7eb0"
      icon={<StickyNote className="h-3.5 w-3.5" />}
      title={title || 'Note'}
      titleInput={
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="w-full bg-transparent text-xs font-medium text-text placeholder:text-text-muted outline-none cursor-text"
        />
      }
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2">
        {!compact && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full bg-transparent text-sm font-medium text-text placeholder:text-text-muted outline-none cursor-text"
          />
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something..."
          className="w-full min-h-[60px] resize-none bg-transparent text-xs text-text-secondary placeholder:text-text-muted outline-none cursor-text leading-relaxed"
        />
      </div>
    </BaseNode>
  )
})
