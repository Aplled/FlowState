import { useState, useRef, useEffect } from 'react'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, NoteData } from '@/types/database'

export function NoteNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as NoteData
  const updateNode = useNodeStore((s) => s.updateNode)
  const [content, setContent] = useState(data.content)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (content === data.content) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(node.id, { data: { ...data, content } as unknown as FlowNode['data'] })
    }, 500)
    return () => clearTimeout(timeoutRef.current)
  }, [content])

  return (
    <div className="max-w-2xl mx-auto w-full p-8">
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write something..."
        className="w-full min-h-[calc(100vh-200px)] bg-transparent text-base text-text placeholder:text-text-muted outline-none resize-none leading-relaxed"
      />
    </div>
  )
}
