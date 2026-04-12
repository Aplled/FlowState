import { create } from 'zustand'
import type { GoogleCalendar, GoogleEvent } from '@/services/calendar-sync'

const STORAGE_KEY = 'flowstate-calendar-sync'

function loadSaved(): { selectedCalendarId: string | null; syncFrequencyMs: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { selectedCalendarId: null, syncFrequencyMs: 5 * 60 * 1000 }
  } catch { return { selectedCalendarId: null, syncFrequencyMs: 5 * 60 * 1000 } }
}

function save(state: { selectedCalendarId: string | null; syncFrequencyMs: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

interface CalendarSyncState {
  connected: boolean
  calendars: GoogleCalendar[]
  selectedCalendarId: string | null
  syncFrequencyMs: number
  lastSyncAt: string | null
  syncing: boolean
  error: string | null

  // In-memory cache of Google events for the selected calendar
  googleEvents: GoogleEvent[]

  setConnected: (v: boolean) => void
  setCalendars: (c: GoogleCalendar[]) => void
  setSelectedCalendar: (id: string | null) => void
  setSyncFrequency: (ms: number) => void
  setLastSyncAt: (ts: string | null) => void
  setSyncing: (v: boolean) => void
  setError: (e: string | null) => void

  setGoogleEvents: (events: GoogleEvent[]) => void
  upsertGoogleEvent: (event: GoogleEvent) => void
  removeGoogleEvent: (eventId: string) => void
  clearGoogleEvents: () => void
}

const saved = loadSaved()

export const useCalendarSyncStore = create<CalendarSyncState>((set, get) => ({
  connected: false,
  calendars: [],
  selectedCalendarId: saved.selectedCalendarId,
  syncFrequencyMs: saved.syncFrequencyMs,
  lastSyncAt: null,
  syncing: false,
  error: null,
  googleEvents: [],

  setConnected: (connected) => set({ connected }),
  setCalendars: (calendars) => set({ calendars }),
  setSelectedCalendar: (selectedCalendarId) => { set({ selectedCalendarId }); save({ selectedCalendarId, syncFrequencyMs: get().syncFrequencyMs }) },
  setSyncFrequency: (syncFrequencyMs) => { set({ syncFrequencyMs }); save({ selectedCalendarId: get().selectedCalendarId, syncFrequencyMs }) },
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncing: (syncing) => set({ syncing }),
  setError: (error) => set({ error }),

  setGoogleEvents: (googleEvents) => set({ googleEvents }),
  upsertGoogleEvent: (event) =>
    set((s) => {
      const idx = s.googleEvents.findIndex((e) => e.id === event.id)
      if (idx === -1) return { googleEvents: [...s.googleEvents, event] }
      const next = s.googleEvents.slice()
      next[idx] = event
      return { googleEvents: next }
    }),
  removeGoogleEvent: (eventId) =>
    set((s) => ({ googleEvents: s.googleEvents.filter((e) => e.id !== eventId) })),
  clearGoogleEvents: () => set({ googleEvents: [] }),
}))
