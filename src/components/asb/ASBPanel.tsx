import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { preloadEmbeddingModel } from '@/services/embeddings'
import { useASBStore, type SortMode, type ASBItem } from '@/stores/asb-store'
import { useFolderStore } from '@/stores/folder-store'
import { useShallow } from 'zustand/react/shallow'
import { useNodeStore } from '@/stores/node-store'
import { Link2 } from 'lucide-react'
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
  return (
    (d.title as string) ||
    (d.label as string) ||
    (d.content as string)?.slice(0, 40) ||
    `Untitled ${item.node.type}`
  )
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
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  // Include embedded workspaces in the manual picker — they're valid
  // routing targets.
  const workspaces = useFolderStore(useShallow((s) => s.workspaces))
  const sortToWorkspace = useASBStore((s) => s.sortToWorkspace)
  const currentWs = workspaces.find((w) => w.id === currentWsId)

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(!open)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text bg-bg-hover hover:bg-bg-tertiary px-2 py-1 rounded transition-colors cursor-pointer"
      >
        <span className="truncate max-w-[100px]">{currentWs?.name ?? 'Pick workspace'}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-[61] bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto"
          >
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
        </>,
        document.body,
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
        {item.children && item.children.length > 0 && (
          <span
            className="text-[9px] bg-purple-400/15 text-purple-300 px-1.5 py-0.5 rounded-full font-medium shrink-0"
            title={`${item.children.length} child node${item.children.length > 1 ? 's' : ''}`}
          >
            +{item.children.length}
          </span>
        )}
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

      {/* Reason + source badge */}
      {sortMode !== 'manual' && item.reason && (
        <div className="flex items-center gap-1 mt-1">
          {item.source === 'classifier' && (
            <Eye className="h-3 w-3 text-accent shrink-0" />
          )}
          {item.source === 'embedding' && (
            <Link2 className="h-3 w-3 text-info shrink-0" />
          )}
          <p className="text-[10px] text-text-muted truncate">{item.reason}</p>
        </div>
      )}

      {/* Connection suggestions */}
      {item.suggested_connections.length > 0 && <ConnectionSuggestions item={item} />}
    </div>
  )
}

function ConnectionSuggestions({ item }: { item: ASBItem }) {
  const allNodes = useNodeStore((s) => s.allNodes)
  return (
    <div className="mt-2 pl-1 border-l-2 border-blue-400/20 space-y-0.5">
      <div className="flex items-center gap-1 text-[9px] text-text-muted/70 uppercase tracking-wide mb-0.5">
        <Link2 className="h-2.5 w-2.5" />
        related
      </div>
      {item.suggested_connections.slice(0, 3).map((sug) => {
        const target = allNodes.find((n) => n.id === sug.target_node_id)
        const d = target?.data as Record<string, unknown> | undefined
        const title = (d?.title as string) || (d?.content as string)?.slice(0, 40) || 'Untitled'
        const isAuto = sug.score >= 0.85
        return (
          <div
            key={sug.target_node_id}
            className="flex items-center gap-1.5 text-[10px] text-text-muted"
            title={`${Math.round(sug.score * 100)}% — ${sug.reason}`}
          >
            <span className={isAuto ? 'text-blue-400' : 'text-text-muted/60'}>
              {isAuto ? '→' : '~'}
            </span>
            <span className="truncate flex-1">{title}</span>
            <span className="text-[9px] tabular-nums shrink-0">{Math.round(sug.score * 100)}%</span>
          </div>
        )
      })}
    </div>
  )
}

function DumpPad() {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  // Synchronous guard — the busy state update can lag behind a fast double-click,
  // and multiple in-flight addDump calls will thrash the LLM.
  const busyRef = useRef(false)
  const addDump = useASBStore((s) => s.addDump)

  // Lightweight line count — no parser, no model, no work per keystroke.
  const lineCount = text.trim() ? text.split('\n').filter((l) => l.trim()).length : 0

  const handleDone = async () => {
    if (busyRef.current) return
    const t = text.trim()
    if (!t) return
    busyRef.current = true
    setBusy(true)
    setText('')
    try {
      await addDump(t)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleDone()
    }
  }

  return (
    <div className="px-3 py-3 border-b border-border/50">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Dump anything... thoughts, todos, links, meetings. Press Done to sort."
        rows={focused || text ? 4 : 2}
        className="w-full bg-bg-hover/50 border border-border/50 focus:border-accent/50 focus:bg-bg-hover rounded-lg px-2.5 py-2 text-xs text-text placeholder:text-text-muted/60 resize-none outline-none transition-all"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-text-muted/60">
          {lineCount > 0 ? `${lineCount} line${lineCount > 1 ? 's' : ''}` : '\u00A0'}
        </span>
        <button
          onClick={handleDone}
          disabled={!text.trim() || busy}
          aria-busy={busy}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-accent text-white text-[11px] font-medium hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-all cursor-pointer"
        >
          {busy ? <div className="loader-sm" /> : <Check className="h-3 w-3" />}
          {busy ? 'Sorting...' : 'Done'}
        </button>
      </div>
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

  // Warm up only the lightweight embedding model on open. The heavy LLM
  // (~1.8GB + WebGPU compile) is deferred until the user actually focuses
  // the dump pad — otherwise it locks the main thread while typing.
  useEffect(() => {
    if (isOpen) void preloadEmbeddingModel()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={toggleOpen}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[480px] max-h-[80vh] bg-bg-secondary border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-text">Dump</span>
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
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

        {/* Write-pad */}
        <DumpPad />

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
              <Inbox className="h-10 w-10 text-text-muted/30 mb-3" />
              <p className="text-sm text-text-muted mb-1">Dump is empty</p>
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
      </div>
    </>
  )
}
