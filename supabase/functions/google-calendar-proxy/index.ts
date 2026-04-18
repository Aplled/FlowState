// Supabase Edge Function: google-calendar-proxy
//
// Server-side proxy for every Google Calendar API call the client makes.
// Existed because the previous code read `session.provider_token` client-side
// and attached it to fetches at `https://www.googleapis.com/calendar/v3/...`,
// which meant the token sat in localStorage and was reachable by any XSS. Now
// the token never leaves the function: the client sends a structured action +
// a Supabase JWT, and this function resolves the user's Google refresh token
// from `auth.identities` (via service role), exchanges it for a fresh access
// token, caches the access token in-memory for its lifetime, and forwards the
// request to Google on the user's behalf.
//
// Deploy:
//   supabase functions deploy google-calendar-proxy
//
// Secrets the user must set (these correspond to the Google OAuth app that
// backs the Supabase Google provider — find them in Supabase Dashboard →
// Authentication → Providers → Google):
//   supabase secrets set GOOGLE_CLIENT_ID=...
//   supabase secrets set GOOGLE_CLIENT_SECRET=...
//
// Relies on standard env vars Supabase injects automatically:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//
// Design decisions worth flagging:
//
// 1. API surface is a discriminated union, NOT a generic URL proxy. Exposing
//    an arbitrary URL would be an SSRF + scope-escalation hole (calendar
//    scopes include write on .events, so a poorly-bounded proxy lets an XSS
//    attacker invoke any Google API the token happens to accept).
//
// 2. Token sourcing: Supabase does NOT persist `provider_token` or
//    `provider_refresh_token` server-side — they only appear in the client
//    session momentarily after the OAuth callback, and even then only on the
//    fresh session (never re-hydrated from storage). So the client captures
//    the refresh token via `onAuthStateChange` and POSTs it to us with
//    `action: 'storeRefreshToken'`, which we upsert into `user_oauth_tokens`.
//    All subsequent calendar actions read from that table, exchange the
//    refresh token for a short-lived access token, and cache the access
//    token in-memory until its `expires_in` (minus a 60s safety margin).
//
// 3. Field whitelisting: client-supplied `event` payloads are stripped to a
//    known set of fields with length caps. Blocks the client from, say,
//    sending `{ organizer: { email: 'attacker@...' } }` through.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const GOOGLE_API = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const ALLOWED_ORIGINS = new Set([
  'tauri://localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
  'http://tauri.localhost',
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

// In-memory token bucket per user. Same best-effort pattern as groq-classify
// and link-preview. Calendar sync can legitimately batch (sync pulls all
// events, then pushes updates for each locally-modified event), so the window
// is wider than Groq's.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
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

// Per-user fresh-access-token cache. Key: userId. Value: token + absolute
// expiry. Function instances are short-lived; this avoids refreshing on every
// single request within one warm instance.
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>()

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// --- Input validation ---------------------------------------------------

const MAX_SUMMARY = 1024
const MAX_DESCRIPTION = 8192
const MAX_LOCATION = 1024
const MAX_ATTENDEES = 200
const MAX_RECURRENCE = 50
const MAX_STRING_ITEM = 512

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function cappedString(v: unknown, max: number): string | undefined {
  if (!isString(v)) return undefined
  if (v.length > max) return undefined
  return v
}

interface GoogleTimeObject {
  dateTime?: string
  date?: string
  timeZone?: string
}

function sanitizeTime(v: unknown): GoogleTimeObject | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const out: GoogleTimeObject = {}
  const dt = cappedString(o.dateTime, 64)
  const d = cappedString(o.date, 32)
  const tz = cappedString(o.timeZone, 64)
  if (dt) out.dateTime = dt
  if (d) out.date = d
  if (tz) out.timeZone = tz
  if (!out.dateTime && !out.date) return undefined
  return out
}

interface GoogleAttendee {
  email: string
  displayName?: string
  optional?: boolean
}

function sanitizeAttendees(v: unknown): GoogleAttendee[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: GoogleAttendee[] = []
  for (const item of v.slice(0, MAX_ATTENDEES)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const email = cappedString(o.email, 320)
    if (!email) continue
    const entry: GoogleAttendee = { email }
    const displayName = cappedString(o.displayName, 256)
    if (displayName) entry.displayName = displayName
    if (typeof o.optional === 'boolean') entry.optional = o.optional
    out.push(entry)
  }
  return out
}

interface GoogleReminders {
  useDefault?: boolean
  overrides?: Array<{ method: string; minutes: number }>
}

function sanitizeReminders(v: unknown): GoogleReminders | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const out: GoogleReminders = {}
  if (typeof o.useDefault === 'boolean') out.useDefault = o.useDefault
  if (Array.isArray(o.overrides)) {
    const overrides: Array<{ method: string; minutes: number }> = []
    for (const r of o.overrides.slice(0, 10)) {
      if (!r || typeof r !== 'object') continue
      const ro = r as Record<string, unknown>
      const method = cappedString(ro.method, 16)
      const minutes = typeof ro.minutes === 'number' && Number.isFinite(ro.minutes) ? ro.minutes : undefined
      if (!method || minutes === undefined) continue
      if (method !== 'email' && method !== 'popup') continue
      overrides.push({ method, minutes })
    }
    if (overrides.length > 0) out.overrides = overrides
  }
  return out
}

function sanitizeRecurrence(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v.slice(0, MAX_RECURRENCE)) {
    if (!isString(item)) continue
    if (item.length > MAX_STRING_ITEM) continue
    // Only allow RFC5545 rule lines — the shapes Google accepts.
    if (!/^(RRULE|EXRULE|RDATE|EXDATE):/.test(item)) continue
    out.push(item)
  }
  return out.length > 0 ? out : undefined
}

/**
 * Whitelist the fields we accept on an event body. Any unknown keys are
 * silently dropped — we never forward unrecognized input to Google.
 */
function sanitizeEventInput(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const summary = cappedString(o.summary, MAX_SUMMARY)
  if (summary !== undefined) out.summary = summary

  const description = cappedString(o.description, MAX_DESCRIPTION)
  if (description !== undefined) out.description = description

  const location = cappedString(o.location, MAX_LOCATION)
  if (location !== undefined) out.location = location

  const start = sanitizeTime(o.start)
  if (start) out.start = start
  const end = sanitizeTime(o.end)
  if (end) out.end = end

  const attendees = sanitizeAttendees(o.attendees)
  if (attendees) out.attendees = attendees

  const reminders = sanitizeReminders(o.reminders)
  if (reminders) out.reminders = reminders

  const recurrence = sanitizeRecurrence(o.recurrence)
  if (recurrence) out.recurrence = recurrence

  return out
}

// --- Calendar id validation --------------------------------------------

/**
 * Calendar IDs are emails (primary) or opaque tokens ending in
 * @group.calendar.google.com. Cap length and reject path-traversal-ish
 * characters so a hostile client can't slip `/../` into the URL.
 */
function isValidCalendarId(v: unknown): v is string {
  if (!isString(v)) return false
  if (v.length === 0 || v.length > 256) return false
  // Forbid URL-breaking characters. encodeURIComponent would handle these,
  // but belt-and-suspenders — pattern lets only things that look like an
  // email / Google id through.
  return /^[A-Za-z0-9._@+\-#]+$/.test(v)
}

function isValidEventId(v: unknown): v is string {
  if (!isString(v)) return false
  if (v.length === 0 || v.length > 1024) return false
  // Google event IDs: base32hex-ish, sometimes with _ and underscores used in
  // recurrence IDs. Keep this narrow.
  return /^[A-Za-z0-9_@.\-]+$/.test(v)
}

function isValidToken(v: unknown, maxLen = 4096): v is string {
  if (!isString(v)) return false
  if (v.length === 0 || v.length > maxLen) return false
  return true
}

function isValidRfc3339(v: unknown): v is string {
  if (!isString(v)) return false
  if (v.length === 0 || v.length > 64) return false
  // Not strictly validating — just blocking obvious junk / header injection.
  return /^[0-9T:.\-+Z]+$/.test(v)
}

// --- OAuth refresh ------------------------------------------------------

type AccessTokenFailure =
  | { kind: 'user_lookup_failed'; detail: string }
  | { kind: 'no_refresh_token'; detail: string }
  | { kind: 'refresh_failed'; detail: string }

type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; failure: AccessTokenFailure }

async function getGoogleRefreshToken(
  adminSupabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: true; refreshToken: string } | { ok: false; failure: AccessTokenFailure }> {
  const { data, error } = await adminSupabase
    .from('user_oauth_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()
  if (error) {
    const detail = error.message
    console.error('user_oauth_tokens select failed:', detail)
    return { ok: false, failure: { kind: 'user_lookup_failed', detail } }
  }
  const refreshToken = (data as { refresh_token?: string } | null)?.refresh_token
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    console.error(`no stored refresh token for user ${userId}`)
    return {
      ok: false,
      failure: { kind: 'no_refresh_token', detail: 'no row in user_oauth_tokens' },
    }
  }
  return { ok: true, refreshToken }
}

async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ ok: true; accessToken: string; expiresIn: number } | { ok: false; detail: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`google token refresh ${res.status}: ${text.slice(0, 500)}`)
    return { ok: false, detail: `${res.status} ${text.slice(0, 200)}` }
  }
  const data = await res.json().catch(() => null) as { access_token?: string; expires_in?: number } | null
  if (!data || typeof data.access_token !== 'string') {
    return { ok: false, detail: 'google response missing access_token' }
  }
  const expiresIn = typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
    ? data.expires_in
    : 3600
  return { ok: true, accessToken: data.access_token, expiresIn }
}

async function getAccessTokenForUser(
  adminSupabase: ReturnType<typeof createClient>,
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<AccessTokenResult> {
  const now = Date.now()
  const cached = tokenCache.get(userId)
  if (cached && cached.expiresAt > now + 5_000) return { ok: true, accessToken: cached.accessToken }

  const tokenResult = await getGoogleRefreshToken(adminSupabase, userId)
  if (!tokenResult.ok) return { ok: false, failure: tokenResult.failure }

  const fresh = await refreshGoogleAccessToken(tokenResult.refreshToken, clientId, clientSecret)
  if (!fresh.ok) return { ok: false, failure: { kind: 'refresh_failed', detail: fresh.detail } }

  tokenCache.set(userId, {
    accessToken: fresh.accessToken,
    expiresAt: now + (fresh.expiresIn - 60) * 1000,
  })
  return { ok: true, accessToken: fresh.accessToken }
}

// --- Google fetch helper -----------------------------------------------

async function gfetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`google ${res.status} ${path}: ${text.slice(0, 500)}`)
    throw new Error(`google ${res.status}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// --- Request handlers ---------------------------------------------------

interface ActionRequest {
  action: string
  [key: string]: unknown
}

async function handleAction(
  accessToken: string,
  reqBody: ActionRequest,
): Promise<{ status: number; body: unknown }> {
  switch (reqBody.action) {
    case 'listCalendars': {
      const data = await gfetch<unknown>(accessToken, '/users/me/calendarList')
      return { status: 200, body: data }
    }

    case 'listEvents': {
      if (!isValidCalendarId(reqBody.calendarId)) {
        return { status: 400, body: { error: 'invalid calendarId' } }
      }
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '2500',
      })
      if (isValidRfc3339(reqBody.timeMin)) params.set('timeMin', reqBody.timeMin as string)
      if (isValidRfc3339(reqBody.timeMax)) params.set('timeMax', reqBody.timeMax as string)
      if (isValidToken(reqBody.pageToken)) params.set('pageToken', reqBody.pageToken as string)
      if (isValidToken(reqBody.syncToken)) {
        params.set('syncToken', reqBody.syncToken as string)
        // Google rejects orderBy + syncToken — drop incompatible params.
        params.delete('orderBy')
        params.delete('timeMin')
        params.delete('timeMax')
      }
      const data = await gfetch<unknown>(
        accessToken,
        `/calendars/${encodeURIComponent(reqBody.calendarId as string)}/events?${params}`,
      )
      return { status: 200, body: data }
    }

    case 'getEvent': {
      if (!isValidCalendarId(reqBody.calendarId)) return { status: 400, body: { error: 'invalid calendarId' } }
      if (!isValidEventId(reqBody.eventId)) return { status: 400, body: { error: 'invalid eventId' } }
      const data = await gfetch<unknown>(
        accessToken,
        `/calendars/${encodeURIComponent(reqBody.calendarId as string)}/events/${encodeURIComponent(reqBody.eventId as string)}`,
      )
      return { status: 200, body: data }
    }

    case 'createEvent': {
      if (!isValidCalendarId(reqBody.calendarId)) return { status: 400, body: { error: 'invalid calendarId' } }
      const body = sanitizeEventInput(reqBody.event)
      if (!body) return { status: 400, body: { error: 'invalid event' } }
      if (!body.start || !body.end) return { status: 400, body: { error: 'event requires start and end' } }
      const data = await gfetch<unknown>(
        accessToken,
        `/calendars/${encodeURIComponent(reqBody.calendarId as string)}/events`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      return { status: 200, body: data }
    }

    case 'updateEvent': {
      if (!isValidCalendarId(reqBody.calendarId)) return { status: 400, body: { error: 'invalid calendarId' } }
      if (!isValidEventId(reqBody.eventId)) return { status: 400, body: { error: 'invalid eventId' } }
      const body = sanitizeEventInput(reqBody.event)
      if (!body) return { status: 400, body: { error: 'invalid event' } }
      const data = await gfetch<unknown>(
        accessToken,
        `/calendars/${encodeURIComponent(reqBody.calendarId as string)}/events/${encodeURIComponent(reqBody.eventId as string)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      )
      return { status: 200, body: data }
    }

    case 'deleteEvent': {
      if (!isValidCalendarId(reqBody.calendarId)) return { status: 400, body: { error: 'invalid calendarId' } }
      if (!isValidEventId(reqBody.eventId)) return { status: 400, body: { error: 'invalid eventId' } }
      await gfetch<void>(
        accessToken,
        `/calendars/${encodeURIComponent(reqBody.calendarId as string)}/events/${encodeURIComponent(reqBody.eventId as string)}`,
        { method: 'DELETE' },
      )
      return { status: 200, body: { ok: true } }
    }

    default:
      return { status: 400, body: { error: 'unknown action' } }
  }
}

// --- Entry point --------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json(req, { error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!supabaseUrl || !supabaseAnon || !supabaseServiceRole) {
    console.error('supabase env missing')
    return json(req, { error: 'internal error' }, 500)
  }
  if (!googleClientId || !googleClientSecret) {
    console.error('google oauth client env missing')
    return json(req, { error: 'internal error' }, 500)
  }

  // Verify the caller's JWT. Pass the token explicitly rather than relying
  // on the global-headers config — the explicit form is more reliable across
  // supabase-js versions and gives us a clearer error to log.
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData.user) {
    console.error('auth.getUser failed:', userErr?.message ?? 'no user in payload')
    return json(req, { error: 'unauthorized', detail: userErr?.message ?? 'no user' }, 401)
  }

  const userId = userData.user.id
  if (!rateLimit(userId)) return json(req, { error: 'rate limited' }, 429)

  let body: ActionRequest
  try {
    body = await req.json() as ActionRequest
  } catch {
    return json(req, { error: 'invalid json body' }, 400)
  }
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') {
    return json(req, { error: 'invalid request' }, 400)
  }

  // Admin client — used to read/write user_oauth_tokens. Never handed any
  // user-controlled SQL; only the authenticated userId is used in filters.
  const adminSupabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // `storeRefreshToken` runs before the access-token-dependent path because
  // the whole point is that the client just obtained a refresh token from
  // the OAuth callback and needs to persist it — asking for an access token
  // first would be circular.
  if (body.action === 'storeRefreshToken') {
    const refreshToken = cappedString((body as { refreshToken?: unknown }).refreshToken, 4096)
    if (!refreshToken) return json(req, { error: 'invalid refresh token' }, 400)
    const { error: upsertErr } = await adminSupabase
      .from('user_oauth_tokens')
      .upsert({
        user_id: userId,
        provider: 'google',
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      })
    if (upsertErr) {
      console.error('user_oauth_tokens upsert failed:', upsertErr.message)
      return json(req, { error: 'store failed' }, 500)
    }
    // A newer refresh token invalidates any cached access token from the
    // previous one — purge so the next call re-exchanges.
    tokenCache.delete(userId)
    return json(req, { ok: true }, 200)
  }

  const tokenResult = await getAccessTokenForUser(
    adminSupabase,
    userId,
    googleClientId,
    googleClientSecret,
  )
  if (!tokenResult.ok) {
    // The caller is logged into Supabase but hasn't connected Google (or
    // their refresh token was revoked). Distinct from a 401 — it's a
    // missing-prerequisite, not bad auth. Surface the specific failure so
    // the client / devtools can tell which of the four failure modes hit.
    return json(
      req,
      { error: 'google not connected', reason: tokenResult.failure.kind, detail: tokenResult.failure.detail },
      409,
    )
  }

  try {
    const result = await handleAction(tokenResult.accessToken, body)
    return json(req, result.body, result.status)
  } catch (err) {
    // If Google rejected for an expired token, purge the cache so the next
    // call refreshes fresh. Rare but harmless to do unconditionally on error.
    tokenCache.delete(userId)
    console.error('google-calendar-proxy failed:', (err as Error).message)
    return json(req, { error: 'calendar api failed' }, 502)
  }
})
