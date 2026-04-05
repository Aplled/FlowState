import type { EventData } from '@/types/database'

const BASE_URL = 'https://www.googleapis.com/calendar/v3'

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function gfetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(token), ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar API error ${res.status}: ${body}`)
  }
  // DELETE returns 204 with no body
  if (res.status === 204) return undefined as unknown as T
  return res.json()
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

export async function fetchGoogleCalendars(token: string): Promise<GoogleCalendar[]> {
  const data = await gfetch<GoogleCalendarListResponse>(token, '/users/me/calendarList')
  return data.items ?? []
}

export async function fetchGoogleEvents(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  })
  const data = await gfetch<GoogleEventsListResponse>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  )
  return (data.items ?? []).filter((e) => e.status !== 'cancelled')
}

export async function pushEventToGoogle(
  token: string,
  calendarId: string,
  event: EventData,
): Promise<GoogleEvent> {
  return gfetch<GoogleEvent>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(eventDataToGoogle(event)),
    },
  )
}

export async function updateGoogleEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: EventData,
): Promise<GoogleEvent> {
  return gfetch<GoogleEvent>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(eventDataToGoogle(event)),
    },
  )
}

export async function deleteGoogleEvent(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await gfetch<void>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
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
