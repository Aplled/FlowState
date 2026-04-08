import { create } from 'zustand'
import type { GoogleCalendar, GoogleEvent } from '@/services/calendar-sync'

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

export const useCalendarSyncStore = create<CalendarSyncState>((set) => ({
  connected: false,
  calendars: [],
  selectedCalendarId: null,
  syncFrequencyMs: 5 * 60 * 1000,
  lastSyncAt: null,
  syncing: false,
  error: null,
  googleEvents: [],

  setConnected: (connected) => set({ connected }),
  setCalendars: (calendars) => set({ calendars }),
  setSelectedCalendar: (selectedCalendarId) => set({ selectedCalendarId }),
  setSyncFrequency: (syncFrequencyMs) => set({ syncFrequencyMs }),
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
