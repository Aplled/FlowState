import { useEffect, useRef, useState } from 'react'
import { MapPin, AlignLeft, Trash2, X } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { getGoogleAccessToken } from '@/lib/google-auth'
import {
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
  type GoogleEvent,
} from '@/services/calendar-sync'
import type { EventData } from '@/types/database'

interface EventEditModalProps {
  open: boolean
  /** Existing Google event to edit. If null, modal is in create mode. */
  event: GoogleEvent | null
  /** Default date for new events (used when event is null). */
  defaultDate?: Date
  onClose: () => void
}

interface FormState {
  title: string
  location: string
  description: string
  allDay: boolean
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endDate: string
  endTime: string
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toLocalParts(iso: string | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date()
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function fromForm(form: FormState): { start: string; end: string } {
  if (form.allDay) {
    // Google requires end.date to be exclusive (the day AFTER the last day).
    return { start: form.startDate, end: addDays(form.endDate, 1) }
  }
  return {
    start: new Date(`${form.startDate}T${form.startTime}`).toISOString(),
    end: new Date(`${form.endDate}T${form.endTime}`).toISOString(),
  }
}

function buildInitialForm(event: GoogleEvent | null, defaultDate?: Date): FormState {
  if (event) {
    const allDay = !event.start.dateTime
    if (allDay) {
      return {
        title: event.summary ?? '',
        location: event.location ?? '',
        description: event.description ?? '',
        allDay: true,
        startDate: event.start.date ?? '',
        startTime: '09:00',
        endDate: event.end.date ? addDays(event.end.date, -1) : (event.start.date ?? ''),
        endTime: '10:00',
      }
    }
    const s = toLocalParts(event.start.dateTime)
    const e = toLocalParts(event.end.dateTime)
    return {
      title: event.summary ?? '',
      location: event.location ?? '',
      description: event.description ?? '',
      allDay: false,
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
    }
  }
  const base = defaultDate ?? new Date()
  const dateStr = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
  return {
    title: '',
    location: '',
    description: '',
    allDay: false,
    startDate: dateStr,
    startTime: '09:00',
    endDate: dateStr,
    endTime: '10:00',
  }
}

export function EventEditModal({ open, event, defaultDate, onClose }: EventEditModalProps) {
  const calendarId = useCalendarSyncStore((s) => s.selectedCalendarId)
  const upsertGoogleEvent = useCalendarSyncStore((s) => s.upsertGoogleEvent)
  const removeGoogleEvent = useCalendarSyncStore((s) => s.removeGoogleEvent)

  const [form, setForm] = useState<FormState>(() => buildInitialForm(event, defaultDate))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(event, defaultDate))
      setError(null)
      setTimeout(() => titleRef.current?.focus(), 0)
    }
  }, [open, event, defaultDate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isEdit = event != null
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (!calendarId) {
      setError('No calendar selected')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const token = await getGoogleAccessToken()
      if (!token) throw new Error('Not signed in to Google')

      const { start, end } = fromForm(form)
      const data: EventData = {
        title: form.title.trim(),
        start_time: start,
        end_time: end,
        all_day: form.allDay,
        location: form.location || undefined,
        description: form.description || undefined,
        google_calendar_id: calendarId,
        google_event_id: event?.id,
      }

      const saved = isEdit
        ? await updateGoogleEvent(token, calendarId, event!.id, data)
        : await pushEventToGoogle(token, calendarId, data)

      upsertGoogleEvent(saved)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit || !calendarId || !event) return
    setDeleting(true)
    setError(null)
    try {
      const token = await getGoogleAccessToken()
      if (!token) throw new Error('Not signed in to Google')
      await deleteGoogleEvent(token, calendarId, event.id)
      removeGoogleEvent(event.id)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  const busy = saving || deleting

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-[420px] p-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">
            {isEdit ? 'Edit event' : 'New event'}
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded hover:bg-bg-hover text-text-muted cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Event title"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => update('allDay', e.target.checked)}
              className="cursor-pointer"
            />
            All day
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-text-muted font-medium w-10">Start</span>
              <DatePicker
                value={form.startDate}
                onChange={(v) => update('startDate', v ?? '')}
                outputFormat="date-only"
                className="flex-1"
              />
              {!form.allDay && (
                <TimePicker
                  value={form.startTime}
                  onChange={(v) => update('startTime', v)}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-text-muted font-medium w-10">End</span>
              <DatePicker
                value={form.endDate}
                onChange={(v) => update('endDate', v ?? '')}
                outputFormat="date-only"
                className="flex-1"
              />
              {!form.allDay && (
                <TimePicker
                  value={form.endTime}
                  onChange={(v) => update('endTime', v)}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-text-muted shrink-0" />
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Location"
              className="flex-1 px-2 py-1.5 text-xs bg-bg-tertiary border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-start gap-2">
            <AlignLeft className="h-4 w-4 text-text-muted mt-2 shrink-0" />
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Description"
              rows={3}
              className="flex-1 px-2 py-1.5 text-xs bg-bg-tertiary border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-5">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={busy}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer disabled:opacity-50 transition"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border cursor-pointer disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent/80 cursor-pointer disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
