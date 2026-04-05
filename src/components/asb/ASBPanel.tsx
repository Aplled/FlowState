import { useState } from 'react'
import { useASBStore, type SortMode, type ASBItem } from '@/stores/asb-store'
import { useFolderStore } from '@/stores/folder-store'
import {
  X,
  Inbox,
  Check,
  XCircle,
  Trash2,
  ChevronDown,
  Zap,
  Eye,
  Hand,
  RefreshCw,
  CheckSquare,
  StickyNote,
  FileText,
  Calendar,
  Globe,
  Pencil,
  Table2,
  Layers,
  ArrowRightLeft,
} from 'lucide-react'
import type { NodeType } from '@/types/database'

const nodeTypeIcon: Record<NodeType, React.ReactNode> = {
  task: <CheckSquare className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  doc: <FileText className="h-3.5 w-3.5" />,
  event: <Calendar className="h-3.5 w-3.5" />,
  browser: <Globe className="h-3.5 w-3.5" />,
  draw: <Pencil className="h-3.5 w-3.5" />,
  table: <Table2 className="h-3.5 w-3.5" />,
  tab: <ArrowRightLeft className="h-3.5 w-3.5" />,
  grouple: <Layers className="h-3.5 w-3.5" />,
}

const modeIcons: Record<SortMode, React.ReactNode> = {
  suggest: <Eye className="h-3.5 w-3.5" />,
  auto: <Zap className="h-3.5 w-3.5" />,
  manual: <Hand className="h-3.5 w-3.5" />,
}

const modeLabels: Record<SortMode, string> = {
  suggest: 'Suggest',
  auto: 'Auto',
  manual: 'Manual',
}

function getNodeTitle(item: ASBItem): string {
  const d = item.node.data as Record<string, unknown>
  return (d.title as string) || (d.content as string)?.slice(0, 40) || `Untitled ${item.node.type}`
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    confidence >= 0.7 ? 'text-green-400 bg-green-400/10' :
    confidence >= 0.4 ? 'text-yellow-400 bg-yellow-400/10' :
    'text-text-muted bg-bg-hover'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>
      {pct}%
    </span>
  )
}

function WorkspaceDropdown({
  itemId,
  currentWsId,
}: {
  itemId: string
  currentWsId: string | null
}) {
  const [open, setOpen] = useState(false)
  const workspaces = useFolderStore((s) => s.workspaces)
  const sortToWorkspace = useASBStore((s) => s.sortToWorkspace)
  const currentWs = workspaces.find((w) => w.id === currentWsId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text bg-bg-hover hover:bg-bg-tertiary px-2 py-1 rounded transition-colors cursor-pointer"
      >
        <span className="truncate max-w-[100px]">{currentWs?.name ?? 'Pick workspace'}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  sortToWorkspace(itemId, ws.id)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-bg-hover transition-colors cursor-pointer"
              >
                {ws.name}
              </button>
            ))}
            {workspaces.length === 0 && (
              <div className="px-3 py-2 text-xs text-text-muted">No workspaces</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ASBItemRow({ item }: { item: ASBItem }) {
  const sortMode = useASBStore((s) => s.sortMode)
  const acceptSuggestion = useASBStore((s) => s.acceptSuggestion)
  const rejectSuggestion = useASBStore((s) => s.rejectSuggestion)
  const removeFromASB = useASBStore((s) => s.removeFromASB)

  const hasSuggestion = item.suggested_workspace_id && item.confidence > 0

  return (
    <div className="group px-3 py-2.5 hover:bg-bg-hover/50 transition-colors border-b border-border/50 last:border-b-0">
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-accent shrink-0">{nodeTypeIcon[item.node.type]}</span>
        <span className="text-xs font-medium text-text truncate flex-1">{getNodeTitle(item)}</span>
        <button
          onClick={() => removeFromASB(item.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Suggestion / Action row */}
      <div className="flex items-center gap-1.5">
        {sortMode !== 'manual' && hasSuggestion && (
          <>
            <ConfidenceBadge confidence={item.confidence} />
            <WorkspaceDropdown itemId={item.id} currentWsId={item.suggested_workspace_id} />
            <button
              onClick={() => acceptSuggestion(item.id)}
              className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors cursor-pointer"
              title="Accept suggestion"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => rejectSuggestion(item.id)}
              className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
              title="Reject suggestion"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {(sortMode === 'manual' || !hasSuggestion) && (
          <WorkspaceDropdown itemId={item.id} currentWsId={null} />
        )}
      </div>

      {/* Reason */}
      {sortMode !== 'manual' && item.reason && (
        <p className="text-[10px] text-text-muted mt-1 truncate">{item.reason}</p>
      )}
    </div>
  )
}

export function ASBPanel() {
  const isOpen = useASBStore((s) => s.isOpen)
  const toggleOpen = useASBStore((s) => s.toggleOpen)
  const items = useASBStore((s) => s.items)
  const sortMode = useASBStore((s) => s.sortMode)
  const setSortMode = useASBStore((s) => s.setSortMode)
  const runSorting = useASBStore((s) => s.runSorting)

  const modes: SortMode[] = ['suggest', 'auto', 'manual']

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={toggleOpen}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-bg-secondary border-l border-border z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-text">Inbox</span>
            {items.length > 0 && (
              <span className="text-[10px] bg-accent/15 text-accent font-medium px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={runSorting}
              className="p-1.5 rounded text-text-muted hover:text-text hover:bg-bg-hover transition-colors cursor-pointer"
              title="Re-run sorting"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleOpen}
              className="p-1.5 rounded text-text-muted hover:text-text hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sort mode selector */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortMode === m
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text hover:bg-bg-hover'
              }`}
            >
              {modeIcons[m]}
              {modeLabels[m]}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <Inbox className="h-10 w-10 text-text-muted/30 mb-3" />
              <p className="text-sm text-text-muted mb-1">Inbox is empty</p>
              <p className="text-xs text-text-muted/60 leading-relaxed">
                Use <kbd className="px-1 py-0.5 rounded bg-bg-hover text-[10px] font-mono">Cmd+Shift+Space</kbd> to
                quick-capture nodes, or drag nodes here from the canvas.
              </p>
            </div>
          ) : (
            items.map((item) => <ASBItemRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </>
  )
}
