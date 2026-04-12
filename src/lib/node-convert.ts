/**
 * Convert a node from one type to another while preserving as much of the
 * original content as possible. Used by the "Convert to" context menu and
 * the "Smart convert" AI pathway.
 */
import type { FlowNode, Json, NodeType } from '@/types/database'
import { inferNodeFromText } from '@/services/groq-classifier'

/** Types that can sensibly hold free-form text content. We don't offer
 *  conversion into/out of structured types (table, draw, grouple, tab). */
export const CONVERTIBLE_TYPES: NodeType[] = ['task', 'note', 'doc', 'event', 'browser']

export function isConvertible(type: NodeType): boolean {
  return CONVERTIBLE_TYPES.includes(type)
}

interface ExtractedText {
  title: string
  content: string
  tags: string[]
}

function extractText(node: FlowNode): ExtractedText {
  const d = (node.data ?? {}) as Record<string, unknown>
  const title =
    (typeof d.title === 'string' && d.title.trim()) ||
    (typeof d.label === 'string' && d.label.trim()) ||
    ''
  const content =
    (typeof d.content === 'string' && d.content) ||
    (typeof d.description === 'string' && d.description) ||
    (typeof d.url === 'string' && d.url) ||
    ''
  const tags = Array.isArray(d.tags)
    ? (d.tags.filter((t) => typeof t === 'string') as string[])
    : []
  const fallbackTitle = title || content.trim().split('\n')[0].slice(0, 80) || `Untitled ${node.type}`
  return { title: fallbackTitle, content, tags }
}

const URL_RE = /https?:\/\/\S+/i

/**
 * Build the `data` payload for a target type from an existing node's content.
 * Preserves title, body, and tags where the target type supports them.
 */
export function convertNodeData(node: FlowNode, to: NodeType): Json {
  const { title, content, tags } = extractText(node)
  switch (to) {
    case 'task': {
      const d = (node.data ?? {}) as Record<string, Json>
      const data: Record<string, Json> = {
        title,
        status: (typeof d.status === 'string' ? d.status : 'todo') as Json,
        priority: (typeof d.priority === 'string' ? d.priority : 'none') as Json,
        tags: tags as unknown as Json,
      }
      if (typeof d.due_date === 'string') data.due_date = d.due_date
      return data as Json
    }
    case 'note':
      return { title, content: content || title, tags } as unknown as Json
    case 'doc':
      return { title, content: content || title } as unknown as Json
    case 'event': {
      const d = (node.data ?? {}) as Record<string, Json>
      const start =
        (typeof d.start_time === 'string' && d.start_time) ||
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const end =
        (typeof d.end_time === 'string' && d.end_time) ||
        new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString()
      return {
        title,
        start_time: start,
        end_time: end,
        all_day: false,
        tags,
      } as unknown as Json
    }
    case 'browser': {
      const urlMatch = (content || title).match(URL_RE)
      const url = urlMatch
        ? urlMatch[0]
        : (node.data as Record<string, unknown>)?.url && typeof (node.data as Record<string, unknown>).url === 'string'
        ? ((node.data as Record<string, string>).url as string)
        : 'https://'
      return { url, title, tags } as unknown as Json
    }
    default:
      return node.data as Json
  }
}

/**
 * Ask the LLM to pick the best type for this node's text and return a fully
 * rebuilt node payload. Falls back to null on failure so callers can surface
 * an error to the user.
 */
export async function smartConvertNode(
  node: FlowNode,
): Promise<{ type: NodeType; data: Json } | null> {
  const { title, content } = extractText(node)
  const text = [title, content].filter(Boolean).join('\n').slice(0, 2000)
  if (!text.trim()) return null
  const result = await inferNodeFromText(text)
  if (!result) return null
  return { type: result.type, data: result.data }
}
