import { useState, useEffect, useRef } from 'react'
import { useUiStore } from '@/stores/ui-store'
import { useFolderStore } from '@/stores/folder-store'
import { Search, FileText, CheckSquare, Calendar, Network } from 'lucide-react'

interface Command {
  id: string
  label: string
  icon: typeof Search
  action: () => void
  section: string
}

export function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, setView } = useUiStore()
  const { workspaces, setActiveWorkspace } = useFolderStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        toggleCommandPalette()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, toggleCommandPalette])

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandPaletteOpen])

  if (!commandPaletteOpen) return null

  const commands: Command[] = [
    { id: 'tasks', label: 'Go to Tasks', icon: CheckSquare, action: () => { setView('tasks'); toggleCommandPalette() }, section: 'Navigation' },
    { id: 'calendar', label: 'Go to Calendar', icon: Calendar, action: () => { setView('calendar'); toggleCommandPalette() }, section: 'Navigation' },
    { id: 'graph', label: 'Go to Graph View', icon: Network, action: () => { setView('graph'); toggleCommandPalette() }, section: 'Navigation' },
    ...workspaces.map((ws) => ({
      id: ws.id,
      label: ws.name,
      icon: FileText,
      action: () => { setActiveWorkspace(ws.id); setView('canvas'); toggleCommandPalette() },
      section: 'Workspaces',
    })),
  ]

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  const sections = [...new Set(filtered.map((c) => c.section))]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={toggleCommandPalette}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands and workspaces..."
            className="flex-1 bg-transparent text-sm text-text placeholder-text-muted outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-text-muted">Esc</kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {sections.map((section) => (
            <div key={section}>
              <p className="px-4 py-1 text-xs font-medium text-text-muted">{section}</p>
              {filtered
                .filter((c) => c.section === section)
                .map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-hover hover:text-text"
                  >
                    <cmd.icon className="h-4 w-4" />
                    {cmd.label}
                  </button>
                ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">No results found</p>
          )}
        </div>
      </div>
    </div>
  )
}
