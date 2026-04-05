import { useEffect, useRef, useState } from 'react'
import {
  CheckSquare,
  StickyNote,
  FileText,
  Table,
  Calendar,
  Globe,
  Pencil,
  FolderOpen,
  Group,
  Download,
  Image,
  ChevronRight,
  Ungroup,
} from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { exportNodeAsMarkdown, exportNodeAsImage, exportWorkspaceAsMarkdown, downloadFile } from '@/lib/export'
import type { NodeType, FlowNode } from '@/types/database'

interface CanvasContextMenuProps {
  x: number
  y: number
  onAddNode: (type: NodeType) => void
  onClose: () => void
}

const items: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'task', label: 'Task', icon: <CheckSquare className="h-4 w-4" />, color: '#f59e0b' },
  { type: 'note', label: 'Note', icon: <StickyNote className="h-4 w-4" />, color: '#a78bfa' },
  { type: 'doc', label: 'Document', icon: <FileText className="h-4 w-4" />, color: '#3b82f6' },
  { type: 'table', label: 'Table', icon: <Table className="h-4 w-4" />, color: '#14b8a6' },
  { type: 'event', label: 'Event', icon: <Calendar className="h-4 w-4" />, color: '#f472b6' },
  { type: 'browser', label: 'Browser', icon: <Globe className="h-4 w-4" />, color: '#6366f1' },
  { type: 'draw', label: 'Draw', icon: <Pencil className="h-4 w-4" />, color: '#22c55e' },
  { type: 'tab', label: 'Embed Workspace', icon: <FolderOpen className="h-4 w-4" />, color: '#64748b' },
  { type: 'grouple', label: 'Group', icon: <Group className="h-4 w-4" />, color: '#8b5cf6' },
]

function GroupSubmenu({ groupNodes, onSelect }: { groupNodes: FlowNode[]; onSelect: (gId: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors cursor-default">
        <Group className="h-4 w-4 text-text-muted" />
        <span className="flex-1">Add to group</span>
        <ChevronRight className="h-3 w-3 text-text-muted" />
      </div>
      {open && (
        <div className="absolute left-full top-0 ml-1 min-w-[140px] rounded-lg border border-border bg-surface shadow-xl py-1 z-50">
          {groupNodes.map((g) => {
            const gData = g.data as any
            return (
              <button
                key={g.id}
                onClick={() => onSelect(g.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
              >
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: gData?.color || '#8b5cf6' }} />
                <span className="truncate">{gData?.label || 'Group'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CanvasContextMenu({ x, y, onAddNode, onClose }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const selectedNodeIds = useNodeStore((s) => s.selectedNodeIds)
  const nodes = useNodeStore((s) => s.nodes)
  const connections = useNodeStore((s) => s.connections)

  const setParent = useNodeStore((s) => s.setParent)
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  const hasParentedNodes = selectedNodes.some((n) => n.parent_id !== null)
  // Groups available to add selected non-group nodes into
  const groupNodes = nodes.filter((n) => n.type === 'grouple')
  const nonGroupSelected = selectedNodes.filter((n) => n.type !== 'grouple')
  const canAddToGroup = nonGroupSelected.length > 0 && groupNodes.length > 0

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleExportMarkdown = () => {
    onClose()
    if (selectedNodes.length === 1) {
      const md = exportNodeAsMarkdown(selectedNodes[0])
      downloadFile(md, `${selectedNodes[0].type}-${selectedNodes[0].id.slice(0, 6)}.md`, 'text/markdown')
    } else if (selectedNodes.length > 1) {
      const md = exportWorkspaceAsMarkdown(selectedNodes, connections)
      downloadFile(md, 'export.md', 'text/markdown')
    } else {
      const md = exportWorkspaceAsMarkdown(nodes, connections)
      downloadFile(md, 'workspace.md', 'text/markdown')
    }
  }

  const handleExportImage = () => {
    onClose()
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'draw') {
      exportNodeAsImage(selectedNodes[0]).then((blob) => downloadFile(blob, 'drawing.png', 'image/png'))
    }
  }

  const showImageExport = selectedNodes.length === 1 && selectedNodes[0].type === 'draw'

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Export section */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Export
      </div>
      <button
        onClick={handleExportMarkdown}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
      >
        <Download className="h-4 w-4 text-text-muted" />
        <span>Export as Markdown</span>
      </button>
      {showImageExport && (
        <button
          onClick={handleExportImage}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
        >
          <Image className="h-4 w-4 text-text-muted" />
          <span>Export as Image</span>
        </button>
      )}

      {(hasParentedNodes || canAddToGroup) && (
        <>
          <div className="my-1 h-px bg-border" />
          {canAddToGroup && groupNodes.length === 1 && (() => {
            const g = groupNodes[0]
            const gData = g.data as any
            return (
              <button
                key={g.id}
                onClick={() => {
                  for (const n of nonGroupSelected) setParent(n.id, g.id)
                  onClose()
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
              >
                <Group className="h-4 w-4" style={{ color: gData?.color || '#8b5cf6' }} />
                <span>Add to {gData?.label || 'Group'}</span>
              </button>
            )
          })()}
          {canAddToGroup && groupNodes.length > 1 && (
            <GroupSubmenu
              groupNodes={groupNodes}
              onSelect={(gId) => {
                for (const n of nonGroupSelected) setParent(n.id, gId)
                onClose()
              }}
            />
          )}
          {hasParentedNodes && (
            <button
              onClick={() => {
                for (const n of selectedNodes) {
                  if (n.parent_id) setParent(n.id, null)
                }
                onClose()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
            >
              <Ungroup className="h-4 w-4 text-text-muted" />
              <span>Remove from group</span>
            </button>
          )}
        </>
      )}

      <div className="my-1 h-px bg-border" />

      {/* Add node section */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Add Node
      </div>
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddNode(item.type)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors"
        >
          <span style={{ color: item.color }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
