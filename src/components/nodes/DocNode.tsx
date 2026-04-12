import { memo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { useLayoutStore } from '@/stores/layout-store'
import type { FlowNode, DocData } from '@/types/database'

interface DocNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const DocNode = memo(function DocNode({ node, selected, connectTarget, onDragStart, onSelect }: DocNodeProps) {
  const data = node.data as unknown as DocData
  const updateNode = useNodeStore((s) => s.updateNode)
  const compact = useLayoutStore((s) => s.compactNodeHeaders)
  const [title, setTitle] = useState(data.title)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: data.content || '',
    onUpdate: ({ editor }) => {
      updateNode(node.id, { data: { ...data, content: editor.getHTML() } as unknown as FlowNode['data'] })
    },
  })

  const saveTitle = () => {
    if (title !== data.title) {
      updateNode(node.id, { data: { ...data, title } as unknown as FlowNode['data'] })
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#5b7fa5"
      icon={<FileText className="h-3.5 w-3.5" />}
      title={title || 'Untitled'}
      titleInput={
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          placeholder="Document title"
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
            onBlur={saveTitle}
            placeholder="Document title"
            className="w-full bg-transparent text-sm font-medium text-text placeholder:text-text-muted outline-none cursor-text"
          />
        )}
        <div className="tiptap-container text-xs">
          <EditorContent editor={editor} />
        </div>
      </div>
    </BaseNode>
  )
})
