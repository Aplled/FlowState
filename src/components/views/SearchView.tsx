import { useCallback, useMemo, useState } from 'react'
import { Select } from '@/components/ui/Select'
import {
  Search,
  CheckSquare,
  StickyNote,
  FileText,
  Table2,
  CalendarDays,
  Globe,
  Pencil,
  ArrowRightLeft,
  Group,
  Filter,
  X,
} from 'lucide-react'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import type { FlowNode, NodeType, Json } from '@/types/database'

const nodeTypeIcons: Record<NodeType, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4 text-blue-400" />,
  note: <StickyNote className="h-4 w-4 text-yellow-400" />,
  doc: <FileText className="h-4 w-4 text-green-400" />,
  table: <Table2 className="h-4 w-4 text-purple-400" />,
  event: <CalendarDays className="h-4 w-4 text-orange-400" />,
  browser: <Globe className="h-4 w-4 text-cyan-400" />,
  draw: <Pencil className="h-4 w-4 text-pink-400" />,
  tab: <ArrowRightLeft className="h-4 w-4 text-gray-400" />,
  grouple: <Group className="h-4 w-4 text-indigo-400" />,
}

const nodeTypeLabels: Record<NodeType, string> = {
  task: 'Task', note: 'Note', doc: 'Doc', table: 'Table',
  event: 'Event', browser: 'Browser', draw: 'Draw', tab: 'Tab', grouple: 'Group',
}

const allNodeTypes: NodeType[] = ['task', 'note', 'doc', 'table', 'event', 'browser', 'draw', 'tab', 'grouple']

function getNodeTitle(node: FlowNode): string {
  const d = node.data as Record<string, Json>
  if (d && typeof d === 'object') {
    if (typeof d.title === 'string' && d.title) return d.title
    if (typeof d.content === 'string' && d.content) return d.content.slice(0, 80)
    if (typeof d.label === 'string' && d.label) return d.label
    if (typeof d.url === 'string') return d.url
  }
  return `${node.type} node`
}

function getNodeContent(node: FlowNode): string {
  const d = node.data as Record<string, Json>
  if (d && typeof d === 'object') {
    const parts: string[] = []
    if (typeof d.content === 'string') parts.push(d.content)
    if (typeof d.description === 'string') parts.push(d.description)
    if (typeof d.url === 'string') parts.push(d.url)
    return parts.join(' ').slice(0, 200)
  }
  return ''
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/30 text-text rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function SearchView() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<NodeType>>(new Set())
  const [folderFilter, setFolderFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const allNodes = useNodeStore((s) => s.allNodes)
  const workspaces = useFolderStore((s) => s.workspaces)
  const folders = useFolderStore((s) => s.folders)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspaceTab = useTabStore((s) => s.openWorkspace)
  const setSelectedNodes = useNodeStore((s) => s.setSelectedNodes)
  const fetchNodes = useNodeStore((s) => s.fetchNodes)
  const fetchConnections = useNodeStore((s) => s.fetchConnections)

  const wsMap = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces])
  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])

  const results = useMemo(() => {
    let nodes = allNodes

    // Type filter
    if (typeFilter.size > 0) {
      nodes = nodes.filter((n) => typeFilter.has(n.type))
    }

    // Folder filter
    if (folderFilter) {
      const folderWsIds = new Set(workspaces.filter((w) => w.folder_id === folderFilter).map((w) => w.id))
      nodes = nodes.filter((n) => folderWsIds.has(n.workspace_id))
    }

    // Query filter
    if (query.trim()) {
      const q = query.toLowerCase()
      nodes = nodes.filter((n) => {
        const title = getNodeTitle(n).toLowerCase()
        const content = getNodeContent(n).toLowerCase()
        return title.includes(q) || content.includes(q)
      })
    }

    return nodes.slice(0, 100)
  }, [query, allNodes, typeFilter, folderFilter, workspaces])

  const navigateToNode = useCallback((node: FlowNode) => {
    const ws = wsMap.get(node.workspace_id)
    if (ws) {
      setActiveWorkspace(ws.id)
      openWorkspaceTab(ws.id, ws.name)
      fetchNodes(ws.id)
      fetchConnections(ws.id)
    }
    setTimeout(() => setSelectedNodes([node.id]), 100)
  }, [wsMap, setActiveWorkspace, openWorkspaceTab, fetchNodes, fetchConnections, setSelectedNodes])

  const toggleType = (t: NodeType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Search header */}
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="flex-1 flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-text-muted shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all nodes..."
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-text-muted hover:text-text cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
              showFilters || typeFilter.size > 0 || folderFilter
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-bg-secondary border-border text-text-muted hover:text-text'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="max-w-2xl mx-auto mt-3 flex flex-wrap gap-3">
            {/* Node type chips */}
            <div className="flex flex-wrap gap-1.5">
              {allNodeTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border cursor-pointer transition ${
                    typeFilter.has(t)
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-bg-secondary border-border text-text-muted hover:text-text'
                  }`}
                >
                  {nodeTypeIcons[t]}
                  {nodeTypeLabels[t]}
                </button>
              ))}
            </div>

            {/* Folder filter */}
            <Select
              value={folderFilter ?? ''}
              onChange={(v) => setFolderFilter(v || null)}
              options={[
                { value: '', label: 'All folders' },
                ...folders.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="text-xs text-text-muted mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          {results.length === 0 && query.trim() && (
            <div className="text-center py-12 text-text-muted text-sm">
              No nodes match your search
            </div>
          )}
          {results.map((node) => {
            const ws = wsMap.get(node.workspace_id)
            const folder = ws ? folderMap.get(ws.folder_id) : undefined
            const title = getNodeTitle(node)
            const content = getNodeContent(node)
            return (
              <button
                key={node.id}
                onClick={() => navigateToNode(node)}
                className="w-full flex items-start gap-3 p-3 bg-bg-secondary border border-border rounded-lg hover:border-accent/40 hover:bg-bg-hover transition cursor-pointer text-left"
              >
                <span className="shrink-0 mt-0.5">{nodeTypeIcons[node.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">
                    {highlightMatch(title, query)}
                  </div>
                  {content && (
                    <div className="text-xs text-text-muted mt-1 line-clamp-2">
                      {highlightMatch(content, query)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-text-muted capitalize bg-bg-tertiary px-1.5 py-0.5 rounded">
                      {node.type}
                    </span>
                    {(folder || ws) && (
                      <span className="text-[10px] text-text-muted">
                        {[folder?.name, ws?.name].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
