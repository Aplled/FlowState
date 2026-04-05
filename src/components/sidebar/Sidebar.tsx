import { useCallback, useEffect, useState } from 'react'
import { useFolderStore } from '@/stores/folder-store'
import { useTabStore } from '@/stores/tab-store'
import { useASBStore } from '@/stores/asb-store'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { useAuth, isSupabaseConfigured } from '@/lib/auth'
import { ThemePicker } from '@/components/settings/ThemePicker'
import { CalendarSettings } from '@/components/settings/CalendarSettings'
import {
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Inbox,
  Calendar,
  Loader2,
  LogOut,
  Palette,
} from 'lucide-react'

export function Sidebar() {
  const { user, signOut } = useAuth()
  const {
    folders, workspaces, activeWorkspaceId, sidebarOpen,
    toggleSidebar, setActiveWorkspace,
    fetchFolders, fetchWorkspaces,
    createFolder, createWorkspace, deleteFolder, deleteWorkspace,
    updateWorkspace,
  } = useFolderStore()
  const openWorkspaceTab = useTabStore((s) => s.openWorkspace)
  const asbItemCount = useASBStore((s) => s.items.length)
  const toggleASB = useASBStore((s) => s.toggleOpen)
  const { connected: gcalConnected, syncing: gcalSyncing } = useCalendarSyncStore()

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingWsId, setRenamingWsId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [calSettingsOpen, setCalSettingsOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  useEffect(() => { fetchFolders() }, [fetchFolders])

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        fetchWorkspaces(id)
      }
      return next
    })
  }, [fetchWorkspaces])

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const folder = await createFolder(newFolderName.trim())
    setNewFolderName('')
    setCreatingFolder(false)
    setExpandedFolders((prev) => new Set(prev).add(folder.id))
    const ws = await createWorkspace('Workspace 1', folder.id)
    setActiveWorkspace(ws.id)
    openWorkspaceTab(ws.id, ws.name)
  }

  const handleCreateWorkspace = async (folderId: string) => {
    const count = workspaces.filter((w) => w.folder_id === folderId).length
    const ws = await createWorkspace(`Workspace ${count + 1}`, folderId)
    setActiveWorkspace(ws.id)
    openWorkspaceTab(ws.id, ws.name)
  }

  const startRename = (wsId: string, currentName: string) => {
    setRenamingWsId(wsId)
    setRenameValue(currentName)
  }

  const commitRename = () => {
    if (renamingWsId && renameValue.trim()) {
      updateWorkspace(renamingWsId, { name: renameValue.trim() })
    }
    setRenamingWsId(null)
  }

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-border bg-bg-secondary">
        <button onClick={toggleSidebar} className="p-1.5 rounded text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-56 border-r border-border bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-text">FlowState</span>
        </div>
        <button onClick={toggleSidebar} className="p-1 rounded text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Inbox */}
      <button
        onClick={toggleASB}
        className="flex items-center gap-2 w-full px-3 py-2 border-b border-border text-xs hover:bg-bg-hover transition-colors cursor-pointer"
      >
        <Inbox className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium text-text">Inbox</span>
        {asbItemCount > 0 && (
          <span className="ml-auto text-[10px] bg-accent/15 text-accent font-medium px-1.5 py-0.5 rounded-full">
            {asbItemCount}
          </span>
        )}
      </button>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-2">
        {folders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id)
          const folderWorkspaces = workspaces.filter((w) => w.folder_id === folder.id && !w.parent_workspace_id)
          return (
            <div key={folder.id}>
              <div className="group flex items-center gap-1 px-2 py-1 hover:bg-bg-hover">
                <button onClick={() => toggleFolder(folder.id)} className="p-0.5 cursor-pointer">
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-text-muted" /> : <ChevronRight className="h-3 w-3 text-text-muted" />}
                </button>
                <span className="flex-1 text-xs font-medium text-text truncate">{folder.name}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => handleCreateWorkspace(folder.id)}
                    className="p-0.5 rounded text-text-muted hover:text-text cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteFolder(folder.id)}
                    className="p-0.5 rounded text-text-muted hover:text-danger cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {isExpanded && folderWorkspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => { setActiveWorkspace(ws.id); openWorkspaceTab(ws.id, ws.name) }}
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(ws.id, ws.name) }}
                  className={`flex items-center gap-2 pl-7 pr-2 py-1 text-xs cursor-pointer group
                    ${ws.id === activeWorkspaceId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text'}`}
                >
                  {renamingWsId === ws.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingWsId(null) }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-bg-tertiary rounded px-1.5 py-0.5 text-xs text-text outline-none ring-1 ring-accent cursor-text"
                    />
                  ) : (
                    <span className="flex-1 truncate">{ws.name}</span>
                  )}
                  {renamingWsId !== ws.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id) }}
                      className="hidden group-hover:block p-0.5 rounded text-text-muted hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {/* Create folder */}
        {creatingFolder ? (
          <div className="px-3 py-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false) }}
              onBlur={() => setCreatingFolder(false)}
              placeholder="Folder name"
              className="w-full bg-bg-tertiary rounded px-2 py-1 text-xs text-text outline-none ring-1 ring-border focus:ring-accent"
            />
          </div>
        ) : (
          <button
            onClick={() => setCreatingFolder(true)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
        )}
      </div>

      {/* Google Calendar section */}
      <div className="border-t border-border">
        <button
          onClick={() => setCalSettingsOpen((v) => !v)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-bg-hover cursor-pointer"
        >
          <Calendar className="h-3.5 w-3.5 text-accent" />
          <span className="flex-1 text-left text-text-secondary font-medium">Google Calendar</span>
          {gcalSyncing && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
          {!gcalSyncing && gcalConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          )}
        </button>
        {calSettingsOpen && <CalendarSettings />}
      </div>

      {/* Theme picker */}
      <div className="relative border-t border-border px-3 py-2">
        <button
          onClick={() => setShowThemePicker((v) => !v)}
          className="flex items-center gap-2 w-full text-xs text-text-muted hover:text-text cursor-pointer"
        >
          <Palette className="h-3.5 w-3.5" />
          Theme
        </button>
        {showThemePicker && <ThemePicker onClose={() => setShowThemePicker(false)} />}
      </div>

      {/* User profile */}
      {isSupabaseConfigured && user && (
        <div className="border-t border-border px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-text-secondary truncate">
            {user.user_metadata?.display_name || user.user_metadata?.full_name || user.email}
          </span>
          <button
            onClick={signOut}
            className="p-1 rounded text-text-muted hover:text-danger hover:bg-bg-hover cursor-pointer"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
