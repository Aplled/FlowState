import { useCallback, useEffect, useState } from 'react'
import { Calendar, RefreshCw, Check, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { signInWithGoogle, isGoogleConnected, disconnectGoogle, getGoogleAccessToken } from '@/lib/google-auth'
import { fetchGoogleCalendars } from '@/services/calendar-sync'
import { syncFromGoogle, startPeriodicSync, stopPeriodicSync } from '@/services/sync-engine'

const FREQUENCY_OPTIONS = [
  { label: '1 minute', ms: 60_000 },
  { label: '5 minutes', ms: 300_000 },
  { label: '15 minutes', ms: 900_000 },
  { label: '30 minutes', ms: 1_800_000 },
  { label: 'Manual only', ms: 0 },
]

export function CalendarSettings() {
  const {
    connected, calendars, selectedCalendarId, syncFrequencyMs,
    lastSyncAt, syncing, error,
    setConnected, setCalendars, setSelectedCalendar,
    setSyncFrequency, setLastSyncAt, setSyncing, setError,
    clearGoogleEvents,
  } = useCalendarSyncStore()
  const [initializing, setInitializing] = useState(true)

  const loadCalendars = useCallback(async () => {
    try {
      const token = await getGoogleAccessToken()
      if (!token) return
      const cals = await fetchGoogleCalendars(token)
      setCalendars(cals)
      if (!useCalendarSyncStore.getState().selectedCalendarId) {
        const primary = cals.find((c) => c.primary)
        if (primary) setSelectedCalendar(primary.id)
      }
    } catch (err) {
      setError(`Failed to load calendars: ${(err as Error).message}`)
    }
  }, [setCalendars, setSelectedCalendar, setError])

  // Check connection status on mount
  useEffect(() => {
    isGoogleConnected().then((c) => {
      setConnected(c)
      if (c) loadCalendars()
    }).finally(() => setInitializing(false))
  }, [loadCalendars, setConnected])

  const handleConnect = async () => {
    try {
      setError(null)
      await signInWithGoogle()
    } catch (err) {
      setError(`Failed to connect: ${(err as Error).message}`)
    }
  }

  const handleDisconnect = async () => {
    try {
      stopPeriodicSync()
      await disconnectGoogle()
      setConnected(false)
      setCalendars([])
      setSelectedCalendar(null)
      setLastSyncAt(null)
      clearGoogleEvents()
    } catch (err) {
      setError(`Failed to disconnect: ${(err as Error).message}`)
    }
  }

  const handleSyncNow = async () => {
    if (!selectedCalendarId) return
    setSyncing(true)
    setError(null)
    try {
      const result = await syncFromGoogle()
      setLastSyncAt(new Date().toISOString())
      if (result.errors.length > 0) {
        setError(`Sync completed with ${result.errors.length} error(s)`)
      }
    } catch (err) {
      setError(`Sync failed: ${(err as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleFrequencyChange = (ms: number) => {
    setSyncFrequency(ms)
    stopPeriodicSync()
    if (ms > 0) startPeriodicSync(ms)
  }

  const handleCalendarChange = (calId: string) => {
    setSelectedCalendar(calId)
    clearGoogleEvents()
    syncFromGoogle().catch((err) => setError(`Sync failed: ${(err as Error).message}`))
  }

  if (initializing) {
    return (
      <div className="p-4 flex items-center gap-2 text-text-muted text-sm">
        <div className="loader-sm" />
        Loading...
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 text-sm">
      <div className="flex items-center gap-2 text-text">
        <Calendar className="h-4 w-4 text-accent" />
        <span className="font-semibold">Google Calendar</span>
      </div>

      <div className="space-y-2">
        {connected ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-green-400 text-xs">
              <Check className="h-3 w-3" /> Connected
            </span>
            <button
              onClick={handleDisconnect}
              className="text-xs text-text-muted hover:text-danger px-2 py-1 rounded hover:bg-bg-hover cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent/15 text-accent hover:bg-accent/25 transition cursor-pointer text-xs font-medium"
          >
            Connect Google Account
          </button>
        )}
      </div>

      {connected && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">Calendar</label>
            <Select
              value={selectedCalendarId ?? ''}
              onChange={handleCalendarChange}
              options={[
                { value: '', label: 'Select a calendar' },
                ...calendars.map((cal) => ({
                  value: cal.id,
                  label: `${cal.summary}${cal.primary ? ' (Primary)' : ''}`,
                })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">Sync frequency</label>
            <Select
              value={String(syncFrequencyMs)}
              onChange={(v) => handleFrequencyChange(Number(v))}
              options={FREQUENCY_OPTIONS.map((opt) => ({
                value: String(opt.ms),
                label: opt.label,
              }))}
            />
          </div>

          <button
            onClick={handleSyncNow}
            disabled={syncing || !selectedCalendarId}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary text-text hover:bg-bg-hover transition cursor-pointer text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <div className="loader-sm" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          {lastSyncAt && (
            <div className="text-[10px] text-text-muted">
              Last synced: {new Date(lastSyncAt).toLocaleString()}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">
          <X className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
