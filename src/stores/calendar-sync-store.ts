import { create } from 'zustand'
import type { GoogleCalendar } from '@/services/calendar-sync'

interface CalendarSyncState {
  connected: boolean
  calendars: GoogleCalendar[]
  selectedCalendarId: string | null
  syncFrequencyMs: number
  lastSyncAt: string | null
  syncing: boolean
  error: string | null

  setConnected: (v: boolean) => void
  setCalendars: (c: GoogleCalendar[]) => void
  setSelectedCalendar: (id: string | null) => void
  setSyncFrequency: (ms: number) => void
  setLastSyncAt: (ts: string | null) => void
  setSyncing: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useCalendarSyncStore = create<CalendarSyncState>((set) => ({
  connected: false,
  calendars: [],
  selectedCalendarId: null,
  syncFrequencyMs: 5 * 60 * 1000,
  lastSyncAt: null,
  syncing: false,
  error: null,

  setConnected: (connected) => set({ connected }),
  setCalendars: (calendars) => set({ calendars }),
  setSelectedCalendar: (selectedCalendarId) => set({ selectedCalendarId }),
  setSyncFrequency: (syncFrequencyMs) => set({ syncFrequencyMs }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncing: (syncing) => set({ syncing }),
  setError: (error) => set({ error }),
}))
