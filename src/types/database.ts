export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type NodeType =
  | 'task'
  | 'note'
  | 'doc'
  | 'table'
  | 'event'
  | 'browser'
  | 'draw'
  | 'tab'
  | 'grouple'

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type SortMode = 'suggest' | 'auto' | 'manual'
export type ConnectionStyle = 'solid' | 'dashed' | 'dotted'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_id: string
  color: string | null
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  folder_id: string
  owner_id: string
  sort_order: number
  viewport_x: number
  viewport_y: number
  viewport_zoom: number
  created_at: string
  updated_at: string
}

export interface FlowNode {
  id: string
  workspace_id: string
  type: NodeType
  position_x: number
  position_y: number
  width: number
  height: number
  data: Json
  parent_id: string | null
  is_locked: boolean
  is_expanded: boolean
  z_index: number
  created_at: string
  updated_at: string
}

export interface Connection {
  id: string
  workspace_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  style: ConnectionStyle
  is_directed: boolean
  weight: number | null
  created_at: string
}

export interface AsbItem {
  id: string
  owner_id: string
  node_id: string
  suggested_workspace_id: string | null
  suggested_folder_id: string | null
  confidence: number
  sort_mode: SortMode
  is_sorted: boolean
  created_at: string
}

export interface FolderShare {
  id: string
  folder_id: string
  shared_with_id: string
  permission: 'view' | 'edit' | 'admin'
  created_at: string
}

// Node-specific data shapes
export interface TaskData {
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  due_date?: string
  recurrence?: string
  tags?: string[]
  assignee_id?: string
}

export interface NoteData {
  content: string
  color?: string
}

export interface DocData {
  title: string
  content: string // JSON from editor
}

export interface TableData {
  title: string
  columns: { id: string; name: string; type: string }[]
  rows: Record<string, Json>[]
}

export interface EventData {
  title: string
  description?: string
  start_time: string
  end_time: string
  all_day: boolean
  location?: string
  google_event_id?: string
  recurrence?: string
  color?: string
}

export interface BrowserData {
  url: string
  title?: string
}

export interface DrawData {
  strokes: Json[]
  background?: string
}

export interface TabNodeData {
  target_workspace_id: string
  label?: string
}

export interface GroupleData {
  label?: string
  color?: string
  child_ids: string[]
}
