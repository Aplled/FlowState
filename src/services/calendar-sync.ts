/**
 * Client-side wrapper around the `google-calendar-proxy` Supabase Edge
 * Function. Every Google Calendar HTTP call used to happen in this file
 * directly against `https://www.googleapis.com/calendar/...` with an access
 * token read from the client Supabase session. That token lived in
 * localStorage, so any XSS could hijack the calendar. Now the only thing the
 * client ever sees is the Supabase JWT — the Google OAuth access token is
 * held entirely server-side.
 *
 * Public API (`fetchGoogleCalendars`, `fetchGoogleEvents`, `pushEventToGoogle`,
 * `updateGoogleEvent`, `deleteGoogleEvent`, `googleEventToEventData`) is
 * unchanged so sync-engine.ts / event-auto-sync.ts / EventEditModal.tsx keep
 * working without changes.
 *
 * Token parameters are still present in the signatures for backward
 * compatibility with existing call sites — they're ignored. New callers
 * should pass `null`.
 */

import { supabase } from '@/lib/supabase'
import type { EventData } from '@/types/database'

interface InvokeResult<T> {
  data: T | null
  error: Error | null
}

async function invokeProxy<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T | { error?: string }>(
    'google-calendar-proxy',
    { body },
  ) as unknown as InvokeResult<T | { error?: string }>
  if (error) throw new Error(`Calendar proxy: ${error.message}`)
  if (!data) throw new Error('Calendar proxy: empty response')
  if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: string }).error === 'string') {
    throw new Error(`Calendar proxy: ${(data as { error: string }).error}`)
  }
  return data as T
}

// --- Types for Google Calendar API responses ---

export interface GoogleCalendar {
  id: string
  summary: string
  backgroundColor?: string
  primary?: boolean
  accessRole: string
}

interface GoogleCalendarListResponse {
  items: GoogleCalendar[]
}

export interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  updated: string
  status: string
}

interface GoogleEventsListResponse {
  items: GoogleEvent[]
  nextPageToken?: string
}

// --- API Functions ---

// Token parameters are kept so existing call sites compile unchanged; the
// edge function sources the real token server-side and ignores whatever is
// passed from the client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchGoogleCalendars(_token?: string | null): Promise<GoogleCalendar[]> {
  const data = await invokeProxy<GoogleCalendarListResponse>({ action: 'listCalendars' })
  return data.items ?? []
}

export async function fetchGoogleEvents(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token: string | null,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const data = await invokeProxy<GoogleEventsListResponse>({
    action: 'listEvents',
    calendarId,
    timeMin,
    timeMax,
  })
  return (data.items ?? []).filter((e) => e.status !== 'cancelled')
}

export async function pushEventToGoogle(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token: string | null,
  calendarId: string,
  event: EventData,
): Promise<GoogleEvent> {
  return invokeProxy<GoogleEvent>({
    action: 'createEvent',
    calendarId,
    event: eventDataToGoogle(event),
  })
}

export async function updateGoogleEvent(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token: string | null,
  calendarId: string,
  eventId: string,
  event: EventData,
): Promise<GoogleEvent> {
  return invokeProxy<GoogleEvent>({
    action: 'updateEvent',
    calendarId,
    eventId,
    event: eventDataToGoogle(event),
  })
}

export async function deleteGoogleEvent(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token: string | null,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await invokeProxy<{ ok: boolean }>({
    action: 'deleteEvent',
    calendarId,
    eventId,
  })
}

// --- Mapping helpers ---

export function googleEventToEventData(ge: GoogleEvent, calendarId: string): EventData {
  const allDay = !ge.start.dateTime
  return {
    title: ge.summary ?? '(No title)',
    start_time: ge.start.dateTime ?? ge.start.date ?? '',
    end_time: ge.end.dateTime ?? ge.end.date ?? '',
    all_day: allDay,
    location: ge.location,
    description: ge.description,
    google_event_id: ge.id,
    google_calendar_id: calendarId,
    last_synced_at: new Date().toISOString(),
  }
}

function eventDataToGoogle(event: EventData): Record<string, unknown> {
  const timeField = event.all_day
    ? { start: { date: event.start_time.slice(0, 10) }, end: { date: event.end_time.slice(0, 10) } }
    : { start: { dateTime: event.start_time }, end: { dateTime: event.end_time } }

  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    ...timeField,
  }
}
