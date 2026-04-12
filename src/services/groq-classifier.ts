/**
 * Groq-backed node inference. Uses Llama 3.3 70B via the Groq API — ~200-400ms
 * per dump, free tier is generous enough for personal use.
 *
 * The API key is taken from VITE_GROQ_API_KEY. We call Groq directly from the
 * browser (CORS is allowed), which means the key IS visible in the bundle — fine
 * for a personal project but rotate it if the repo ever goes public.
 */

import type { NodeType, Json } from '@/types/database'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You convert raw user notes into structured nodes for a personal productivity app. Reply with ONE JSON object and nothing else — no prose, no markdown.

Schema:
{
  "type": "task" | "note" | "event" | "doc" | "browser",
  "title": string,              // clean concise title, <= 80 chars, no filler
  "content"?: string,           // optional longer body for note/doc
  "due_date"?: string,          // ISO 8601, only for tasks with a deadline
  "start_time"?: string,        // ISO 8601, only for events
  "end_time"?: string,          // ISO 8601, only for events
  "url"?: string,               // only for browser
  "tags"?: string[]             // 4-8 topical keywords — include the specific subject (e.g. "water-bottle"), the broader domain (e.g. "beverage", "product"), any named entities, and 1-2 activity/intent words. Lowercase, hyphenated, no "#".
}

Rules:
- "task": anything actionable. Infer due_date from phrases like "in 3 days", "by friday", "tomorrow", "next week".
- "event": a scheduled meeting, appointment, call, class, or plan with a specific time.
- "browser": a URL or explicit web link.
- "doc": a longer structured writeup spanning multiple ideas.
- "note": thoughts, observations, ideas, reminders, study notes, anything else.
- Rewrite the title cleanly. Strip "I need to", "remember to", "thinking about", etc. Use sentence case.
- Do NOT summarize or shorten note/doc bodies. The original text is preserved verbatim downstream — your job on notes is type + title + tags only.
- Resolve relative dates against the CURRENT_DATE in the user message.
- Tags are critical: they drive downstream semantic connection between nodes. Be generous and specific. For "landing page for water bottle startup" include ["landing-page", "water-bottle", "startup", "marketing", "web", "product"]. For "call mom about thanksgiving" include ["call", "family", "mom", "thanksgiving", "holiday"]. Prefer 5-8 tags.`

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
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) {
    console.warn('[groq] VITE_GROQ_API_KEY missing — skipping LLM inference')
    return texts.map(() => null)
  }
  if (texts.length === 0) return []

  const today = new Date().toISOString().slice(0, 10)
  const numbered = texts.map((t, i) => `${i + 1}. ${t.trim()}`).join('\n')
  const batchPrompt = `You will receive ${texts.length} numbered inputs. Return a JSON object with a "nodes" array of exactly ${texts.length} items, one per input, in the same order. Each item follows the node schema.

${SYSTEM_PROMPT}

CURRENT_DATE: ${today}

INPUTS:
${numbered}`

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a precise JSON generator. Reply with only valid JSON.' },
          { role: 'user', content: batchPrompt },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[groq] request failed:', res.status, text)
      return texts.map(() => null)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return texts.map(() => null)

    const parsed = JSON.parse(content) as { nodes?: GroqParsed[] }
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
    return texts.map((t, i) => {
      const n = nodes[i]
      if (!n || typeof n !== 'object') return null
      return buildNodeData(n, t)
    })
  } catch (err) {
    console.warn('[groq] inferNodesBatch failed:', err)
    return texts.map(() => null)
  }
}

/** Single-segment convenience wrapper. Prefer inferNodesBatch for multiple. */
export async function inferNodeFromText(text: string): Promise<GroqNodeResult | null> {
  const [result] = await inferNodesBatch([text])
  return result
}
