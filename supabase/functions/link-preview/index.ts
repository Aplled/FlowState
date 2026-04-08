import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)' },
      redirect: 'follow',
    })

    // Only read first 50KB to avoid huge pages
    const reader = res.body?.getReader()
    let html = ''
    const decoder = new TextDecoder()
    if (reader) {
      let bytesRead = 0
      while (bytesRead < 50_000) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})