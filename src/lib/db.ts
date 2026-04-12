import { supabase } from '@/lib/supabase'
import type { Folder, Workspace, FlowNode, Connection } from '@/types/database'

// ── Folders ──────────────────────────────────────────────────────

export async function fetchFolders(userId: string) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at')
  if (error) throw error
  return data as Folder[]
}

export async function createFolder(folder: Folder & { owner_id: string }) {
  const { data, error } = await supabase.from('folders').insert(folder).select().single()
  if (error) throw error
  return data as Folder
}

export async function updateFolder(id: string, updates: Partial<Folder>) {
  const { error } = await supabase.from('folders').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteFolder(id: string) {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw error
}

// ── Workspaces ───────────────────────────────────────────────────

export async function fetchWorkspaces(folderId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at')
  if (error) throw error
  return data as Workspace[]
}

export async function fetchAllWorkspaces(userId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at')
  if (error) throw error
  return data as Workspace[]
}

export async function createWorkspace(workspace: Workspace & { owner_id: string }) {
  const { data, error } = await supabase.from('workspaces').insert(workspace).select().single()
  if (error) throw error
  return data as Workspace
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>) {
  const { error } = await supabase.from('workspaces').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteWorkspace(id: string) {
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) throw error
}

// ── Nodes ────────────────────────────────────────────────────────

export async function fetchAllNodes() {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .order('z_index')
  if (error) throw error
  return data as FlowNode[]
}

export async function fetchAllConnections() {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
  if (error) throw error
  return data as Connection[]
}

export async function fetchNodes(workspaceId: string) {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('z_index')
  if (error) throw error
  return data as FlowNode[]
}

export async function createNode(node: FlowNode) {
  const { data, error } = await supabase.from('nodes').insert(node).select().single()
  if (error) throw error
  return data as FlowNode
}

export async function updateNode(id: string, updates: Partial<FlowNode>) {
  const { error } = await supabase.from('nodes').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteNode(id: string) {
  const { error } = await supabase.from('nodes').delete().eq('id', id)
  if (error) throw error
}

export async function batchUpdateNodes(updates: { id: string; changes: Partial<FlowNode> }[]) {
  // Supabase doesn't have native batch update, so we use Promise.all
  await Promise.all(updates.map(({ id, changes }) => updateNode(id, changes)))
}

// ── Connections ──────────────────────────────────────────────────

export async function fetchConnections(workspaceId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('workspace_id', workspaceId)
  if (error) throw error
  return data as Connection[]
}

export async function createConnection(connection: Connection) {
  const { data, error } = await supabase.from('connections').insert(connection).select().single()
  if (error) throw error
  return data as Connection
}

export async function updateConnection(id: string, updates: Partial<Connection>) {
  const { error } = await supabase.from('connections').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteConnection(id: string) {
  const { error } = await supabase.from('connections').delete().eq('id', id)
  if (error) throw error
}
