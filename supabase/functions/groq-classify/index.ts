// Supabase Edge Function: groq-classify
//
// Server-side proxy for Groq-based node classification. Exists so the Groq API
// key stays in Deno env vars instead of shipping in the client bundle. Requires
// a valid Supabase JWT — the anon key alone is not enough because we want to
// tie rate limits to a real user.
//
// Deploy:   supabase functions deploy groq-classify
// Secrets:  supabase secrets set GROQ_API_KEY=gsk_...

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'
const MAX_TEXTS = 20
const MAX_TEXT_LEN = 4000

// Keep this in sync with the client's expectations. The client still does the
// JSON parse + buildNodeData step, so this function only produces the raw
// Groq response content string.
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

const ALLOWED_ORIGINS = new Set([
  'tauri://localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
  'http://tauri.localhost',
  // Web build hosted on Vercel. These are the stable aliases; the
  // per-deployment hash URLs (flowstate-<hash>-aplleds-projects.vercel.app)
  // are intentionally not allowlisted so preview deploys can't hit prod
  // edge functions without an explicit pattern match added here.
  'https://flowstate-swart.vercel.app',
  'https://flowstate-aplleds-projects.vercel.app',
  'https://flowstate-git-main-aplleds-projects.vercel.app',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'null'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// In-memory token bucket per user. Edge function instances are short-lived and
// multi-instance, so this is best-effort throttling, not a hard limit. Good
// enough to stop a runaway client from hammering Groq; not good enough to
// defend against a motivated attacker with a stolen JWT (rotate JWT secrets if
// that happens).
const WINDOW_MS = 10_000
const MAX_PER_WINDOW = 5
const buckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(userId: string): boolean {
  const now = Date.now()
  const b = buckets.get(userId)
  if (!b || now >= b.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (b.count >= MAX_PER_WINDOW) return false
  b.count += 1
  return true
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405)

  // Auth: Supabase populates the Authorization header when the client uses
  // supabase.functions.invoke. We verify the JWT by calling auth.getUser.
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json(req, { error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!supabaseUrl || !supabaseAnon) {
    console.error('supabase env missing')
    return json(req, { error: 'internal error' }, 500)
  }
  if (!groqKey) {
    console.error('groq key not configured')
    return json(req, { error: 'internal error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json(req, { error: 'unauthorized' }, 401)

  if (!rateLimit(userData.user.id)) return json(req, { error: 'rate limited' }, 429)

  let body: { texts?: unknown; currentDate?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(req, { error: 'invalid json body' }, 400)
  }

  if (!Array.isArray(body.texts)) return json(req, { error: 'texts must be an array' }, 400)
  const texts = body.texts.filter((t): t is string => typeof t === 'string').slice(0, MAX_TEXTS)
  if (texts.length === 0) return json(req, { content: null })
  const tooLong = texts.find((t) => t.length > MAX_TEXT_LEN)
  if (tooLong) return json(req, { error: `text exceeds ${MAX_TEXT_LEN} chars` }, 400)

  const currentDate = typeof body.currentDate === 'string'
    ? body.currentDate
    : new Date().toISOString().slice(0, 10)

  const numbered = texts.map((t, i) => `${i + 1}. ${t.trim()}`).join('\n')
  const batchPrompt = `You will receive ${texts.length} numbered inputs. Return a JSON object with a "nodes" array of exactly ${texts.length} items, one per input, in the same order. Each item follows the node schema.

${SYSTEM_PROMPT}

CURRENT_DATE: ${currentDate}

INPUTS:
${numbered}`

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
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
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`groq ${res.status}: ${text.slice(0, 500)}`)
      return json(req, { error: 'classification failed' }, 502)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return json(req, { content: null })
    return json(req, { content })
  } catch (err) {
    console.error('groq request failed:', (err as Error).message)
    return json(req, { error: 'internal error' }, 500)
  }
})
