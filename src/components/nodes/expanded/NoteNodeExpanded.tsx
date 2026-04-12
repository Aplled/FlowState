import { useCallback, useRef } from 'react'
import { RichEditor } from '@/components/editor/RichEditor'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, NoteData } from '@/types/database'

export function NoteNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as NoteData & { title?: string }
  const updateNode = useNodeStore((s) => s.updateNode)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const onContentChange = useCallback((html: string) => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(node.id, { data: { ...data, content: html } as unknown as FlowNode['data'] })
    }, 300)
  }, [node.id, data, updateNode])

  return (
    <div className="max-w-3xl mx-auto w-full py-8 px-8 space-y-4">
      <input
        value={data.title ?? ''}
        onChange={(e) => updateNode(node.id, { data: { ...data, title: e.target.value } as unknown as FlowNode['data'] })}
        className="w-full text-2xl font-bold bg-transparent text-text outline-none placeholder:text-text-muted/50"
        placeholder="Note title"
      />
      <RichEditor
        content={data.content || ''}
        onChange={onContentChange}
        placeholder="Type '/' for commands..."
        className="min-h-[calc(100vh-280px)]"
      />
    </div>
  )
}
