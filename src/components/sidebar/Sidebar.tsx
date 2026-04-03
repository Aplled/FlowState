import { useEffect, useState } from 'react'
import { useFolderStore } from '@/stores/folder-store'
import { useUiStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  FolderIcon,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Calendar,
  CheckSquare,
  Network,
  Clock,
  Users,
  LogOut,
  Inbox,
} from 'lucide-react'
import type { Folder } from '@/types/database'

function FolderItem({ folder, depth = 0 }: { folder: Folder; depth?: number }) {
  const [expanded, setExpanded] = useState(false)
  const {
    folders,
    workspaces,
    activeFolderId,
    activeWorkspaceId,
    setActiveFolder,
    setActiveWorkspace,
    fetchWorkspaces,
    createWorkspace,
  } = useFolderStore()

  const children = folders.filter((f) => f.parent_id === folder.id)
  const folderWorkspaces = workspaces.filter((w) => w.folder_id === folder.id)
  const isActive = activeFolderId === folder.id

  const handleClick = () => {
    setActiveFolder(folder.id)
    setExpanded(!expanded)
    if (!expanded) fetchWorkspaces(folder.id)
  }

  const handleAddWorkspace = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ws = await createWorkspace('New Workspace', folder.id)
    setActiveWorkspace(ws.id)
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer transition',
          isActive ? 'bg-bg-active text-text' : 'text-text-secondary hover:bg-bg-hover hover:text-text'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {children.length > 0 || folderWorkspaces.length > 0 ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className="w-3.5" />
        )}
        <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folder.color ?? undefined }} />
        <span className="truncate flex-1">{folder.name}</span>
        <button
          onClick={handleAddWorkspace}
          className="hidden group-hover:block rounded p-0.5 hover:bg-bg-active"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div>
          {children.map((child) => (
            <FolderItem key={child.id} folder={child} depth={depth + 1} />
          ))}
          {folderWorkspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer transition',
                activeWorkspaceId === ws.id
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text'
              )}
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ws.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { sidebarOpen, sidebarWidth, setView, currentView, toggleCommandPalette } = useUiStore()
  const { folders, fetchFolders, createFolder } = useFolderStore()
  const { profile, signOut } = useAuthStore()

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  if (!sidebarOpen) return null

  const rootFolders = folders.filter((f) => !f.parent_id)

  const navItems = [
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'tasks' as const, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
    { id: 'graph' as const, icon: Network, label: 'Graph View' },
    { id: 'recents' as const, icon: Clock, label: 'Recents' },
    { id: 'shared' as const, icon: Users, label: 'Shared with Me' },
  ]

  return (
    <div
      className="flex h-full flex-col border-r border-border bg-bg-secondary"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" data-tauri-drag-region>
        <h2 className="text-sm font-semibold text-text">FlowState</h2>
        <button
          onClick={toggleCommandPalette}
          className="rounded-md border border-border px-2 py-0.5 text-xs text-text-muted transition hover:bg-bg-hover hover:text-text"
        >
          ⌘K
        </button>
      </div>

      {/* Quick Nav */}
      <div className="space-y-0.5 px-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition',
              currentView === id
                ? 'bg-bg-active text-text'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ASB / Inbox */}
      <div className="mx-2 mt-3">
        <button className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-sm text-text-muted transition hover:border-accent hover:text-accent">
          <Inbox className="h-4 w-4" />
          Auto Sort Bucket
        </button>
      </div>

      {/* Folders */}
      <div className="mt-3 flex items-center justify-between px-4">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Folders
        </span>
        <button
          onClick={() => createFolder('New Folder')}
          className="rounded p-0.5 text-text-muted transition hover:bg-bg-hover hover:text-text"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-2">
        {rootFolders.map((folder) => (
          <FolderItem key={folder.id} folder={folder} />
        ))}
        {rootFolders.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-muted">
            No folders yet. Create one to get started.
          </p>
        )}
      </div>

      {/* User / Settings */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
            {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm text-text">{profile?.full_name ?? 'User'}</p>
            <p className="truncate text-xs text-text-muted">{profile?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded p-1 text-text-muted transition hover:bg-bg-hover hover:text-text"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
