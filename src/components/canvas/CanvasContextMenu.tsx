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
  Shuffle,
  Link2,
} from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { exportNodeAsMarkdown, exportNodeAsImage, exportWorkspaceAsMarkdown, downloadFile } from '@/lib/export'
import { CONVERTIBLE_TYPES, convertNodeData, isConvertible } from '@/lib/node-convert'
import type { NodeType, FlowNode } from '@/types/database'

interface CanvasContextMenuProps {
  x: number
  y: number
  onAddNode: (type: NodeType) => void
  onClose: () => void
}

const items: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'task', label: 'Task', icon: <CheckSquare className="h-4 w-4" />, color: '#b8860b' },
  { type: 'note', label: 'Note', icon: <StickyNote className="h-4 w-4" />, color: '#9a7eb0' },
  { type: 'doc', label: 'Document', icon: <FileText className="h-4 w-4" />, color: '#5b7fa5' },
  { type: 'table', label: 'Table', icon: <Table className="h-4 w-4" />, color: '#5a7c5a' },
  { type: 'event', label: 'Event', icon: <Calendar className="h-4 w-4" />, color: '#9a7eb0' },
  { type: 'browser', label: 'Browser', icon: <Globe className="h-4 w-4" />, color: '#5b7fa5' },
  { type: 'draw', label: 'Draw', icon: <Pencil className="h-4 w-4" />, color: '#5a7c5a' },
  { type: 'tab', label: 'Embed Workspace', icon: <FolderOpen className="h-4 w-4" />, color: '#9c8e7c' },
  { type: 'grouple', label: 'Group', icon: <Group className="h-4 w-4" />, color: '#8b6f4e' },
]

function ExpandSubmenu({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [above, setAbove] = useState(false)

  useEffect(() => {
    if (!open || !submenuRef.current) return
    const rect = submenuRef.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 8) setAbove(true)
    else setAbove(false)
  }, [open])

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors cursor-default rounded-lg">
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-3 w-3 text-text-muted" />
      </div>
      {open && (
        <div
          ref={submenuRef}
          className="absolute left-full ml-1 min-w-[140px] rounded-xl border border-border bg-surface shadow-lg py-1 z-50"
          style={above ? { bottom: 0 } : { top: 0 }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function CanvasContextMenu({ x, y, onAddNode, onClose }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad
    if (left < pad) left = pad
    if (top < pad) top = pad
    setPos({ left, top })
  }, [x, y])

  const selectedNodeIds = useNodeStore((s) => s.selectedNodeIds)
  const nodes = useNodeStore((s) => s.nodes)
  const connections = useNodeStore((s) => s.connections)

  const setParent = useNodeStore((s) => s.setParent)
  const addToGroup = useNodeStore((s) => s.addToGroup)
  const updateNode = useNodeStore((s) => s.updateNode)
  const addConnection = useNodeStore((s) => s.addConnection)
  const activeWorkspaceId = useFolderStore((s) => s.activeWorkspaceId)
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  const hasParentedNodes = selectedNodes.some((n) => n.parent_id !== null)
  const groupNodes = nodes.filter((n) => n.type === 'grouple')
  const nonGroupSelected = selectedNodes.filter((n) => n.type !== 'grouple')
  const canAddToGroup = nonGroupSelected.length > 0 && groupNodes.length > 0
  const canConnect = selectedNodes.length >= 2 && activeWorkspaceId !== null

  const handleCreateConnections = () => {
    if (!activeWorkspaceId || selectedNodes.length < 2) return onClose()
    for (let i = 0; i < selectedNodeIds.length - 1; i++) {
      addConnection(activeWorkspaceId, selectedNodeIds[i], selectedNodeIds[i + 1])
    }
    onClose()
  }

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

  const convertTarget =
    selectedNodes.length === 1 && isConvertible(selectedNodes[0].type) ? selectedNodes[0] : null

  const handleConvert = (to: NodeType) => {
    if (!convertTarget || to === convertTarget.type) {
      onClose()
      return
    }
    const data = convertNodeData(convertTarget, to)
    updateNode(convertTarget.id, { type: to, data })
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-surface shadow-lg py-1.5"
      style={{ left: pos.left, top: pos.top }}
    >
      {canConnect && (
        <>
          <button
            onClick={handleCreateConnections}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
          >
            <Link2 className="h-4 w-4 text-accent" />
            <span>
              {selectedNodes.length === 2
                ? 'Create connection'
                : `Connect ${selectedNodes.length} nodes in order`}
            </span>
          </button>
        </>
      )}

      {(hasParentedNodes || canAddToGroup) && (
        <>
          <div className="my-1.5 h-px bg-border/60 mx-2" />
          {canAddToGroup && (
            <ExpandSubmenu icon={<Group className="h-4 w-4 text-text-muted" />} label="Add to group">
              {groupNodes.map((g) => {
                const gData = g.data as any
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      for (const n of nonGroupSelected) addToGroup(n.id, g.id)
                      onClose()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
                  >
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: gData?.color || '#8b6f4e' }} />
                    <span className="truncate">{gData?.label || 'Group'}</span>
                  </button>
                )
              })}
            </ExpandSubmenu>
          )}
          {hasParentedNodes && (
            <button
              onClick={() => {
                for (const n of selectedNodes) {
                  if (n.parent_id) setParent(n.id, null)
                }
                onClose()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
            >
              <Ungroup className="h-4 w-4 text-text-muted" />
              <span>Remove from group</span>
            </button>
          )}
        </>
      )}

      {convertTarget && (
        <>
          <div className="my-1.5 h-px bg-border/60 mx-2" />
          <ExpandSubmenu icon={<Shuffle className="h-4 w-4 text-text-muted" />} label="Convert to">
            {items
              .filter((it) => CONVERTIBLE_TYPES.includes(it.type) && it.type !== convertTarget.type)
              .map((it) => (
                <button
                  key={`convert-${it.type}`}
                  onClick={() => handleConvert(it.type)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
                >
                  <span style={{ color: it.color }}>{it.icon}</span>
                  <span>{it.label}</span>
                </button>
              ))}
          </ExpandSubmenu>
        </>
      )}

      {(canConnect || hasParentedNodes || canAddToGroup || convertTarget) && (
        <div className="my-1.5 h-px bg-border/60 mx-2" />
      )}

      {/* Add node section */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Add Node
      </div>
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddNode(item.type)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
        >
          <span style={{ color: item.color }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}

      <div className="my-1.5 h-px bg-border/60 mx-2" />

      {/* Export section */}
      <button
        onClick={handleExportMarkdown}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
      >
        <Download className="h-4 w-4 text-text-muted" />
        <span>Export as Markdown</span>
      </button>
      {showImageExport && (
        <button
          onClick={handleExportImage}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text hover:bg-bg-hover transition-colors rounded-lg"
        >
          <Image className="h-4 w-4 text-text-muted" />
          <span>Export as Image</span>
        </button>
      )}
    </div>
  )
}
