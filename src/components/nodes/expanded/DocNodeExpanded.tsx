import { useCallback, useMemo, useRef } from 'react'
import { RichEditor } from '@/components/editor/RichEditor'
import { useNodeStore } from '@/stores/node-store'
import type { FlowNode, DocData } from '@/types/database'

export function DocNodeExpanded({ node }: { node: FlowNode }) {
  const data = node.data as unknown as DocData
  const updateNode = useNodeStore((s) => s.updateNode)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const onContentChange = useCallback((html: string) => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateNode(node.id, { data: { ...data, content: html } as unknown as FlowNode['data'] })
    }, 300)
  }, [node.id, data, updateNode])

  // Backlinks: find all nodes that reference this node
  const allNodes = useNodeStore((s) => s.allNodes)
  const backlinks = useMemo(() => {
    return allNodes.filter((n) => {
      if (n.id === node.id) return false
      const d = n.data as Record<string, unknown>
      const content = (d?.content as string) || ''
      return content.includes(node.id)
    })
  }, [allNodes, node.id])

  return (
    <div className="max-w-3xl mx-auto w-full py-8 px-8 space-y-4">
      {/* Title */}
      <input
        value={data.title}
        onChange={(e) => updateNode(node.id, { data: { ...data, title: e.target.value } as unknown as FlowNode['data'] })}
        className="w-full text-3xl font-bold bg-transparent text-text outline-none placeholder:text-text-muted/50"
        placeholder="Untitled"
      />

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-text-muted pb-2 border-b border-border/30">
        <span>Created {new Date(node.created_at).toLocaleDateString()}</span>
        <span>Updated {new Date(node.updated_at).toLocaleDateString()}</span>
      </div>

      {/* Rich editor with toolbar and slash commands */}
      <RichEditor
        content={data.content || ''}
        onChange={onContentChange}
        placeholder="Type '/' for commands..."
        className="min-h-[calc(100vh-320px)]"
      />

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="border-t border-border pt-4 mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Backlinks ({backlinks.length})
          </h3>
          <div className="space-y-1">
            {backlinks.map((bl) => {
              const d = bl.data as Record<string, unknown>
              const title = (d?.title as string) || (d?.label as string) || `${bl.type} node`
              return (
                <div key={bl.id} className="text-xs text-text-secondary hover:text-accent cursor-pointer py-1">
                  {title}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
