import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = new Set([
  'tauri://localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
  'http://tauri.localhost',
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

// Hard caps so a hostile target can't exhaust the function.
const MAX_BYTES = 50_000
const FETCH_TIMEOUT_MS = 5_000

// In-memory token bucket per user. Same best-effort pattern as groq-classify.
const WINDOW_MS = 30_000
const MAX_PER_WINDOW = 10
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

/**
 * SSRF guard. BrowserNode URLs are user-supplied, and this function fetches
 * them server-side — so without a gate, the edge runtime could be tricked
 * into hitting internal services, cloud metadata endpoints, or loopback.
 *
 * Blocks http(s) to any IPv4 literal in RFC1918 / loopback / link-local /
 * "this network", IPv6 loopback + ULA + link-local, and string hostnames
 * that obviously point inward (localhost, *.localhost). Doesn't resolve DNS
 * manually — Deno Deploy restricts `Deno.resolveDns` in some contexts, and
 * the runtime itself sandboxes network egress. This is defense in depth.
 */
function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').trim()
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true
  // IPv4 literal
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number)
    if (a === 0 || a === 127) return true            // this network + loopback
    if (a === 10) return true                        // RFC1918
    if (a === 192 && b === 168) return true          // RFC1918
    if (a === 169 && b === 254) return true          // link-local incl. 169.254.169.254 (AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
    if (a >= 224) return true                        // multicast / reserved
  }
  // IPv6 literal — coarse prefix checks
  if (h.includes(':')) {
    if (h === '::1') return true
    if (h.startsWith('fc') || h.startsWith('fd')) return true // ULA (fc00::/7)
    if (/^fe[89ab]/.test(h)) return true                       // link-local (fe80::/10)
  }
  return false
}

function extractMeta(html: string, property: string): string | null {
  // Try og: tags first, then twitter: tags, then name= tags
  for (const attr of [`property="${property}"`, `property="twitter:${property.replace('og:', '')}"`, `name="${property.replace('og:', '')}"`]) {
    const re = new RegExp(`<meta[^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*content=["']([^"']*)["']`, 'i')
    const match = html.match(re)
    if (match) return match[1]
    // Also try content before property
    const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    const match2 = html.match(re2)
    if (match2) return match2[1]
  }
  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // Auth: same pattern as groq-classify — require a Supabase JWT so rate
  // limits are tied to a real user.
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) {
    console.error('supabase env missing')
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (!rateLimit(userData.user.id)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Parse + scheme gate + host gate. Reject before any network call.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'only http(s) urls allowed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (isForbiddenHost(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'host not allowed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // `redirect: 'follow'` stays on so ordinary HTTPS → HTTPS redirects work,
    // but we cap total time with a 5s abort — a hostile target can't tarpit
    // the function by dribbling bytes or chaining redirects.
    const res = await fetch(parsed.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    // Post-redirect check: if the final URL somehow pointed somewhere we
    // wouldn't have allowed up front, bail out instead of parsing it.
    try {
      const finalHost = new URL(res.url).hostname
      if (isForbiddenHost(finalHost)) {
        return new Response(JSON.stringify({ error: 'redirected to forbidden host' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    } catch {
      /* res.url was weird; fall through */
    }

    // Only read first MAX_BYTES to avoid huge pages.
    const reader = res.body?.getReader()
    let html = ''
    const decoder = new TextDecoder()
    if (reader) {
      let bytesRead = 0
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        bytesRead += value.length
      }
      reader.cancel()
    }

    // Extract favicon — try multiple link rel patterns
    let favicon: string | null = null
    const linkTags = html.matchAll(/<link\s[^>]*>/gi)
    for (const m of linkTags) {
      const tag = m[0]
      // Match rel containing "icon" (covers icon, shortcut icon, apple-touch-icon, etc.)
      if (!/rel=["'][^"']*icon/i.test(tag)) continue
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i)
      if (!hrefMatch) continue
      const href = hrefMatch[1]
      // Prefer apple-touch-icon (higher res), but take any icon
      if (/apple-touch-icon/i.test(tag)) { favicon = href; break }
      if (!favicon) favicon = href
    }
    // Fallback: try /favicon.ico at origin
    if (!favicon) {
      try {
        const origin = new URL(url).origin
        favicon = `${origin}/favicon.ico`
      } catch { /* ignore */ }
    }

    const data = {
      title: extractMeta(html, 'og:title') || extractTitle(html) || null,
      description: extractMeta(html, 'og:description') || null,
      image: extractMeta(html, 'og:image') || null,
      siteName: extractMeta(html, 'og:site_name') || null,
      favicon,
    }

    // Resolve relative URLs
    for (const key of ['image', 'favicon'] as const) {
      if (data[key] && !data[key]!.startsWith('http')) {
        try {
          data[key] = new URL(data[key]!, url).href
        } catch { /* ignore */ }
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (e) {
    const err = e as Error
    console.error('link-preview fetch failed:', err.name, err.message)
    const msg = err.name === 'TimeoutError' ? 'timeout' : 'fetch failed'
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
