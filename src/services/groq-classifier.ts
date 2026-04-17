/**
 * Client-side wrapper for node inference. The Groq API key used to live in
 * VITE_GROQ_API_KEY and ship in the bundle — now it's held by the
 * `groq-classify` Supabase Edge Function and calls go through
 * `supabase.functions.invoke`, which attaches the user's JWT automatically.
 *
 * Public API (`inferNodesBatch`, `inferNodeFromText`, `GroqNodeResult`) is
 * unchanged so call sites in asb-store.ts and node-convert.ts keep working.
 */

import { supabase } from '@/lib/supabase'
import type { NodeType, Json } from '@/types/database'

interface GroqParsed {
  type: NodeType
  title?: string
  content?: string
  due_date?: string
  start_time?: string
  end_time?: string
  url?: string
  tags?: string[]
}

export interface GroqNodeResult {
  type: NodeType
  data: Json
}

function buildNodeData(parsed: GroqParsed, originalText: string): GroqNodeResult {
  const validTypes: NodeType[] = ['task', 'note', 'event', 'doc', 'browser']
  const type: NodeType = validTypes.includes(parsed.type) ? parsed.type : 'note'
  const original = originalText.trim()
  // When the LLM omits a title, fall back to a cleaned first line of the
  // original input — strip bullet markers and common filler so the node
  // doesn't render as "- design the landing page".
  const cleanedFallback = original
    .split('\n')[0]
    .replace(/^[\s\-*•]+/, '')
    .replace(/^(i\s+)?(need to|have to|should|must|remember to|gotta|thinking about|note:?|idea:?)\s+/i, '')
    .trim()
  const rawTitle = (parsed.title && parsed.title.trim()) || cleanedFallback || original
  const title = (rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)).slice(0, 200)
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string').slice(0, 10) : []

  switch (type) {
    case 'task': {
      const data: Record<string, Json> = { title, status: 'todo', priority: 'none', tags }
      if (parsed.due_date) data.due_date = parsed.due_date
      return { type, data }
    }
    case 'event': {
      const start = parsed.start_time || new Date(Date.now() + 3600000).toISOString()
      const end = parsed.end_time || new Date(new Date(start).getTime() + 3600000).toISOString()
      return { type, data: { title, start_time: start, end_time: end, all_day: false, tags } }
    }
    case 'browser': {
      return { type, data: { url: parsed.url || original, title, tags } }
    }
    case 'doc': {
      // Always preserve the original text verbatim — never let the LLM
      // summarize it away. Title is the LLM's cleaned version.
      return { type, data: { title, content: original } }
    }
    default:
      // Notes: preserve the full original text as content. The LLM gives us
      // a clean title + tags; it must NOT rewrite the body.
      return { type: 'note', data: { title, content: original, tags } }
  }
}

/**
 * Batch-classify multiple segments in a single Groq call. Much faster than
 * one-call-per-segment because latency dominates over token count.
 */
export async function inferNodesBatch(texts: string[]): Promise<Array<GroqNodeResult | null>> {
  if (texts.length === 0) return []

  const currentDate = new Date().toISOString().slice(0, 10)

  try {
    const { data, error } = await supabase.functions.invoke<{ content?: string; error?: string }>(
      'groq-classify',
      { body: { texts, currentDate } },
    )

    if (error) {
      console.warn('[groq] edge function error:', error.message)
      return texts.map(() => null)
    }
    const content = data?.content
    if (typeof content !== 'string') return texts.map(() => null)

    const parsed = JSON.parse(content) as { nodes?: GroqParsed[] }
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
    return texts.map((t, i) => {
      const n = nodes[i]
      if (!n || typeof n !== 'object') return null
      return buildNodeData(n, t)
    })
  } catch (err) {
    console.warn('[groq] inferNodesBatch failed:', err instanceof Error ? err.message : 'unknown')
    return texts.map(() => null)
  }
}

/** Single-segment convenience wrapper. Prefer inferNodesBatch for multiple. */
export async function inferNodeFromText(text: string): Promise<GroqNodeResult | null> {
  const [result] = await inferNodesBatch([text])
  return result
}
