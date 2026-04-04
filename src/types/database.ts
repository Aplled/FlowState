export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

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

export type ConnectionDirection = 'directed' | 'undirected' | 'bidirectional'

export interface Connection {
  id: string
  workspace_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  style: 'solid' | 'dashed' | 'dotted'
  direction: ConnectionDirection
  // legacy compat
  is_directed?: boolean
  weight: number | null
  created_at: string
}

export interface Workspace {
  id: string
  folder_id: string
  parent_workspace_id: string | null
  name: string
  viewport_x: number
  viewport_y: number
  viewport_zoom: number
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

// node data payloads

export interface TaskData {
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  tags: string[]
  description?: string
}

export interface NoteData {
  title?: string
  content: string
}

export interface DocData {
  title: string
  content: string
}

export interface TableColumn {
  id: string
  name: string
  type: 'text' | 'number' | 'checkbox'
}

export interface TableData {
  title: string
  columns: TableColumn[]
  rows: Record<string, Json>[]
}

export interface EventData {
  title: string
  start_time: string
  end_time: string
  all_day: boolean
  location?: string
  description?: string
}

export interface BrowserData {
  url: string
  title: string
}

export interface DrawStroke {
  id: string
  points: number[][]
  color: string
  size: number
}

export interface DrawData {
  strokes: DrawStroke[]
  background: string
}

export interface TabData {
  target_workspace_id: string
  label: string
}

export interface GroupleData {
  label: string
  color: string
  child_ids: string[]
}
