import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
  Plus,
  Eye,
  Palette,
  Command,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import { safeHttpUrl } from '@/lib/url'
import { isTauri } from '@/lib/env'
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

function getNodeTitle(node: FlowNode): string {
  const d = node.data as Record<string, Json>
  if (d && typeof d === 'object') {
    if (typeof d.title === 'string' && d.title) return d.title
    if (typeof d.content === 'string' && d.content) return d.content.slice(0, 60)
    if (typeof d.label === 'string' && d.label) return d.label
    if (typeof d.url === 'string') return d.url
  }
  return `${node.type} node`
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

interface PaletteItem {
  id: string
  kind: 'node' | 'workspace' | 'action'
  icon: React.ReactNode
  label: string
  sublabel?: string
  onSelect: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allNodes = useNodeStore((s) => s.allNodes)
  const workspaces = useFolderStore((s) => s.workspaces)
  const folders = useFolderStore((s) => s.folders)
  const setActiveWorkspace = useFolderStore((s) => s.setActiveWorkspace)
  const openWorkspaceTab = useTabStore((s) => s.openWorkspace)
  const setSelectedNodes = useNodeStore((s) => s.setSelectedNodes)
  const fetchNodes = useNodeStore((s) => s.fetchNodes)
  const fetchConnections = useNodeStore((s) => s.fetchConnections)
  const toggleGlobalPanel = useTabStore((s) => s.toggleGlobalPanel)

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigateToNode = useCallback((node: FlowNode) => {
    const ws = workspaces.find((w) => w.id === node.workspace_id)
    if (ws) {
      setActiveWorkspace(ws.id)
      openWorkspaceTab(ws.id, ws.name)
      fetchNodes(ws.id)
      fetchConnections(ws.id)
    }
    setTimeout(() => setSelectedNodes([node.id]), 100)
    setOpen(false)
  }, [workspaces, setActiveWorkspace, openWorkspaceTab, fetchNodes, fetchConnections, setSelectedNodes])

  const actions: PaletteItem[] = useMemo(() => [
    {
      id: 'action-new-task', kind: 'action', icon: <Plus className="h-4 w-4 text-blue-400" />,
      label: 'New Task', sublabel: 'Create a new task node',
      onSelect: () => { setOpen(false) },
    },
    {
      id: 'action-new-note', kind: 'action', icon: <Plus className="h-4 w-4 text-yellow-400" />,
      label: 'New Note', sublabel: 'Create a new note node',
      onSelect: () => { setOpen(false) },
    },
    {
      id: 'action-new-doc', kind: 'action', icon: <Plus className="h-4 w-4 text-green-400" />,
      label: 'New Doc', sublabel: 'Create a new document node',
      onSelect: () => { setOpen(false) },
    },
    {
      id: 'action-tasks-view', kind: 'action', icon: <Eye className="h-4 w-4 text-blue-400" />,
      label: 'Open Tasks View', sublabel: 'View all tasks',
      onSelect: () => { toggleGlobalPanel('tasks'); setOpen(false) },
    },
    {
      id: 'action-calendar', kind: 'action', icon: <CalendarDays className="h-4 w-4 text-orange-400" />,
      label: 'Open Calendar', sublabel: 'View calendar',
      onSelect: () => { toggleGlobalPanel('calendar'); setOpen(false) },
    },
    {
      id: 'action-search', kind: 'action', icon: <Search className="h-4 w-4 text-accent" />,
      label: 'Open Search', sublabel: 'Full search view',
      onSelect: () => { toggleGlobalPanel('search'); setOpen(false) },
    },
    {
      id: 'action-graph', kind: 'action', icon: <Command className="h-4 w-4 text-accent" />,
      label: 'Open Graph View', sublabel: 'Visualize all nodes',
      onSelect: () => { toggleGlobalPanel('graph'); setOpen(false) },
    },
    {
      id: 'action-new-browser-window', kind: 'action', icon: <Globe className="h-4 w-4 text-cyan-400" />,
      label: 'New Browser Window', sublabel: 'Open a standalone Chromium window',
      onSelect: () => {
        const input = window.prompt('URL to open:', 'https://www.google.com')
        if (!input) { setOpen(false); return }
        const normalized = safeHttpUrl(input)
        if (!normalized) {
          window.alert('Only http(s) URLs are allowed.')
          setOpen(false)
          return
        }
        if (isTauri) {
          invoke('browser_open_standalone', { url: normalized }).catch((e) =>
            console.error('browser_open_standalone failed', e)
          )
        } else {
          // On web, open the URL in a new tab. noopener/noreferrer to stop
          // the opened page from getting a reference back to this window.
          window.open(normalized, '_blank', 'noopener,noreferrer')
        }
        setOpen(false)
      },
    },
    {
      id: 'action-theme', kind: 'action', icon: <Palette className="h-4 w-4 text-purple-400" />,
      label: 'Toggle Theme', sublabel: 'Switch light/dark theme',
      onSelect: () => {
        document.documentElement.classList.toggle('light')
        setOpen(false)
      },
    },
  ], [toggleGlobalPanel])

  const items: PaletteItem[] = useMemo(() => {
    const wsMap = new Map(workspaces.map((w) => [w.id, w]))
    const folderMap = new Map(folders.map((f) => [f.id, f]))

    const nodeItems: PaletteItem[] = allNodes.map((node) => {
      const ws = wsMap.get(node.workspace_id)
      const folder = ws ? folderMap.get(ws.folder_id) : undefined
      const ctx = [folder?.name, ws?.name].filter(Boolean).join(' / ')
      return {
        id: node.id,
        kind: 'node' as const,
        icon: nodeTypeIcons[node.type],
        label: getNodeTitle(node),
        sublabel: ctx || node.type,
        onSelect: () => navigateToNode(node),
      }
    })

    const wsItems: PaletteItem[] = workspaces.map((ws) => {
      const folder = folderMap.get(ws.folder_id)
      return {
        id: `ws-${ws.id}`,
        kind: 'workspace' as const,
        icon: <ArrowRightLeft className="h-4 w-4 text-accent" />,
        label: ws.name,
        sublabel: folder?.name ?? 'Workspace',
        onSelect: () => {
          setActiveWorkspace(ws.id)
          openWorkspaceTab(ws.id, ws.name)
          fetchNodes(ws.id)
          fetchConnections(ws.id)
          setOpen(false)
        },
      }
    })

    const all = [...actions, ...wsItems, ...nodeItems]

    if (!query.trim()) return all.slice(0, 50)

    return all.filter((item) =>
      fuzzyMatch(item.label, query) || (item.sublabel && fuzzyMatch(item.sublabel, query))
    ).slice(0, 50)
  }, [query, allNodes, workspaces, folders, actions, navigateToNode, setActiveWorkspace, openWorkspaceTab, fetchNodes, fetchConnections])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const el = list.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[selectedIndex]?.onSelect()
    }
  }, [items, selectedIndex])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) setQuery('') }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-[101] top-[20%] left-1/2 -translate-x-1/2 w-[560px] max-h-[60vh] bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes, workspaces, actions..."
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
            />
            <kbd className="text-[10px] text-text-muted bg-bg-tertiary border border-border rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-1">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No results found
              </div>
            )}
            {items.map((item, i) => (
              <button
                key={item.id}
                onClick={item.onSelect}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center gap-3 w-full px-4 py-2 text-left cursor-pointer transition-colors ${
                  i === selectedIndex ? 'bg-accent/15 text-text' : 'text-text-muted hover:bg-bg-hover'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{item.label}</div>
                  {item.sublabel && (
                    <div className="text-[10px] text-text-muted truncate">{item.sublabel}</div>
                  )}
                </div>
                <span className="text-[10px] text-text-muted shrink-0 capitalize">{item.kind}</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
