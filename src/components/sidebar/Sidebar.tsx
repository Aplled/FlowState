import { useCallback, useEffect, useState } from 'react'
import { useFolderStore } from '@/stores/folder-store'
import { useNodeStore } from '@/stores/node-store'
import { useTabStore } from '@/stores/tab-store'
import { useASBStore } from '@/stores/asb-store'
import { useLayoutStore } from '@/stores/layout-store'
import { useAuth, isSupabaseConfigured } from '@/lib/auth'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Inbox,
  Calendar,
  LogOut,
  CheckSquare,
  Search,
  GitFork,
  Settings,
  LayoutGrid,
  FileText,
  StickyNote,
  MoreHorizontal,
  Home,
  Star,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import type { FlowNode, Workspace } from '@/types/database'

function WorkspaceTreeItem({
  ws, depth, activeWorkspaceId, renamingWsId, renameValue, expandedEmbedded, allNodes,
  getChildWorkspaces, setActiveWorkspace, openWorkspaceTab, startRename, setRenameValue,
  commitRename, setRenamingWsId, setConfirmDelete, toggleEmbedded,
}: {
  ws: Workspace
  depth: number
  activeWorkspaceId: string | null
  renamingWsId: string | null
  renameValue: string
  expandedEmbedded: Set<string>
  allNodes: FlowNode[]
  getChildWorkspaces: (id: string) => Workspace[]
  setActiveWorkspace: (id: string) => void
  openWorkspaceTab: (id: string, name: string) => void
  startRename: (id: string, name: string) => void
  setRenameValue: (v: string) => void
  commitRename: () => void
  setRenamingWsId: (id: string | null) => void
  setConfirmDelete: (v: { type: 'folder' | 'workspace'; id: string; name: string } | null) => void
  toggleEmbedded: (id: string) => void
}) {
  const children = getChildWorkspaces(ws.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedEmbedded.has(ws.id)
  const nodeCount = allNodes.filter((n) => n.workspace_id === ws.id).length
  const pl = 4 + depth * 3 // indentation: pl-7 for depth 1, pl-10 for depth 2, etc.

  return (
    <div>
      <div
        onClick={() => { setActiveWorkspace(ws.id); openWorkspaceTab(ws.id, ws.name) }}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(ws.id, ws.name) }}
        className={cn(
          'flex items-center gap-1.5 pr-2 py-1.5 text-xs cursor-pointer group rounded-md',
          ws.id === activeWorkspaceId
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text',
        )}
        style={{ paddingLeft: `${pl * 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleEmbedded(ws.id) }}
            className="p-0 shrink-0 cursor-pointer"
          >
            {isExpanded
              ? <ChevronDown className="h-2.5 w-2.5 text-text-muted" />
              : <ChevronRight className="h-2.5 w-2.5 text-text-muted" />}
          </button>
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        {ws.parent_workspace_id
          ? <Layers className="h-3 w-3 shrink-0 opacity-50" />
          : <FileText className="h-3 w-3 shrink-0 opacity-60" />}
        {renamingWsId === ws.id ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingWsId(null) }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-bg-tertiary rounded-md px-2 py-0.5 text-xs text-text outline-none ring-1 ring-accent cursor-text"
          />
        ) : (
          <>
            <span className="flex-1 truncate">{ws.name}</span>
            {nodeCount > 0 && (
              <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100">{nodeCount}</span>
            )}
          </>
        )}
        {renamingWsId !== ws.id && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'workspace', id: ws.id, name: ws.name }) }}
            className="hidden group-hover:block p-0.5 rounded-md text-text-muted hover:text-danger cursor-pointer transition-colors"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
      {hasChildren && isExpanded && children.map((child) => (
        <WorkspaceTreeItem
          key={child.id}
          ws={child}
          depth={depth + 1}
          activeWorkspaceId={activeWorkspaceId}
          renamingWsId={renamingWsId}
          renameValue={renameValue}
          expandedEmbedded={expandedEmbedded}
          allNodes={allNodes}
          getChildWorkspaces={getChildWorkspaces}
          setActiveWorkspace={setActiveWorkspace}
          openWorkspaceTab={openWorkspaceTab}
          startRename={startRename}
          setRenameValue={setRenameValue}
          commitRename={commitRename}
          setRenamingWsId={setRenamingWsId}
          setConfirmDelete={setConfirmDelete}
          toggleEmbedded={toggleEmbedded}
        />
      ))}
    </div>
  )
}

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
  const toggleGlobalPanel = useTabStore((s) => s.toggleGlobalPanel)
  const activeMainTabId = useTabStore((s) => s.paneActiveTab.main)
  const asbItemCount = useASBStore((s) => s.items.length)
  const toggleASB = useASBStore((s) => s.toggleOpen)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingWsId, setRenamingWsId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'folder' | 'workspace'; id: string; name: string } | null>(null)

  const allNodes = useNodeStore((s) => s.allNodes)
  const [expandedEmbedded, setExpandedEmbedded] = useState<Set<string>>(new Set())

  const toggleEmbedded = useCallback((wsId: string) => {
    setExpandedEmbedded((prev) => {
      const next = new Set(prev)
      if (next.has(wsId)) next.delete(wsId)
      else next.add(wsId)
      return next
    })
  }, [])

  // Get child workspaces of a given workspace
  const getChildWorkspaces = useCallback((parentWsId: string) => {
    return workspaces.filter((w) => w.parent_workspace_id === parentWsId)
  }, [workspaces])

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

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar])

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-3 px-1.5 bg-bg-secondary">
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer transition-colors">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <div className="logo-icon" />
          </div>
          <span className="text-sm font-semibold text-text">FlowState</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={toggleSidebar} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer transition-colors">
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col px-1.5 pb-1 shrink-0">
        <button
          onClick={toggleASB}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs rounded-md hover:bg-bg-hover transition-colors cursor-pointer text-text-secondary"
        >
          <Inbox className="h-3.5 w-3.5" />
          <span>Dump</span>
          {asbItemCount > 0 && (
            <span className="ml-auto text-[10px] bg-accent/12 text-accent font-medium px-1.5 py-0.5 rounded-full">
              {asbItemCount}
            </span>
          )}
        </button>

        <button
          onClick={() => toggleGlobalPanel('search')}
          className={cn(
            'flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            activeMainTabId === '__search__' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover',
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-auto text-[9px] text-text-muted bg-bg-tertiary px-1 py-0.5 rounded">
            {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
          </kbd>
        </button>

        <button
          onClick={() => toggleGlobalPanel('settings')}
          className={cn(
            'flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
            activeMainTabId === '__settings__' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover',
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Separator */}
      <div className="h-px bg-border/50 mx-3 my-1 shrink-0" />

      {/* Views */}
      <div className="flex flex-col px-1.5 pb-1 shrink-0">
        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Views</div>
        {([
          { panel: 'tasks' as const, tabId: '__tasks__', label: 'Tasks', Icon: CheckSquare },
          { panel: 'kanban' as const, tabId: '__kanban__', label: 'Board', Icon: LayoutGrid },
          { panel: 'calendar' as const, tabId: '__calendar__', label: 'Calendar', Icon: Calendar },
          { panel: 'graph' as const, tabId: '__graph__', label: 'Graph', Icon: GitFork },
        ]).map(({ panel, tabId, label, Icon }) => (
          <button
            key={panel}
            onClick={() => toggleGlobalPanel(panel)}
            className={cn(
              'flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs cursor-pointer transition-colors rounded-md',
              activeMainTabId === tabId
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="h-px bg-border/50 mx-3 my-1 shrink-0" />

      {/* Workspaces / Pages */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <div className="flex items-center justify-between px-2.5 py-1 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Workspaces</span>
          <button
            onClick={() => setCreatingFolder(true)}
            className="p-0.5 rounded-md text-text-muted hover:text-text hover:bg-bg-hover cursor-pointer transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {folders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id)
          const folderWorkspaces = workspaces.filter((w) => w.folder_id === folder.id && !w.parent_workspace_id)
          return (
            <div key={folder.id}>
              <div className="group flex items-center gap-1 px-1.5 py-1 hover:bg-bg-hover rounded-md">
                <button onClick={() => toggleFolder(folder.id)} className="p-0.5 cursor-pointer shrink-0">
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-text-muted" /> : <ChevronRight className="h-3 w-3 text-text-muted" />}
                </button>
                <span className="flex-1 text-xs font-medium text-text truncate">{folder.name}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => handleCreateWorkspace(folder.id)}
                    className="p-0.5 rounded-md text-text-muted hover:text-text cursor-pointer transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: 'folder', id: folder.id, name: folder.name })}
                    className="p-0.5 rounded-md text-text-muted hover:text-danger cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {isExpanded && folderWorkspaces.map((ws) => (
                <WorkspaceTreeItem
                  key={ws.id}
                  ws={ws}
                  depth={1}
                  activeWorkspaceId={activeWorkspaceId}
                  renamingWsId={renamingWsId}
                  renameValue={renameValue}
                  expandedEmbedded={expandedEmbedded}
                  allNodes={allNodes}
                  getChildWorkspaces={getChildWorkspaces}
                  setActiveWorkspace={setActiveWorkspace}
                  openWorkspaceTab={openWorkspaceTab}
                  startRename={startRename}
                  setRenameValue={setRenameValue}
                  commitRename={commitRename}
                  setRenamingWsId={setRenamingWsId}
                  setConfirmDelete={setConfirmDelete}
                  toggleEmbedded={toggleEmbedded}
                />
              ))}
            </div>
          )
        })}

        {/* Create folder */}
        {creatingFolder && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false) }}
              onBlur={() => setCreatingFolder(false)}
              placeholder="Folder name"
              className="w-full bg-bg-tertiary rounded-md px-2.5 py-1.5 text-xs text-text outline-none ring-1 ring-border focus:ring-accent"
            />
          </div>
        )}
      </div>

      {/* User profile */}
      {isSupabaseConfigured && user && (
        <div className="shrink-0 border-t border-border/50 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-accent">
                {(user.user_metadata?.display_name || user.email || '?')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-text-secondary truncate">
              {user.user_metadata?.display_name || user.user_metadata?.full_name || user.email}
            </span>
          </div>
          <button
            onClick={signOut}
            className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-bg-hover cursor-pointer transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'folder' ? 'Delete folder?' : 'Delete workspace?'}
        message={
          confirmDelete?.type === 'folder'
            ? `"${confirmDelete.name}" and all its workspaces and nodes will be permanently deleted.`
            : `"${confirmDelete?.name}" and its ${allNodes.filter((n) => n.workspace_id === confirmDelete?.id).length} node(s) will be permanently deleted.`
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) {
            if (confirmDelete.type === 'folder') deleteFolder(confirmDelete.id)
            else deleteWorkspace(confirmDelete.id)
          }
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
