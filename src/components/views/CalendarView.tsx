import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FlowNode, EventData } from '@/types/database'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CalendarView() {
  const [events, setEvents] = useState<FlowNode[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('type', 'event')
        .order('created_at', { ascending: false })
      if (data) setEvents(data as FlowNode[])
    }
    load()
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getEventsForDay = (day: Date) =>
    events.filter((node) => {
      const event = node.data as unknown as EventData
      return event.start_time && isSameDay(new Date(event.start_time), day)
    })

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-bg-hover"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-text">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-bg-hover"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          const inMonth = day.getMonth() === currentMonth.getMonth()
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] rounded-md border border-border p-1.5',
                inMonth ? 'bg-surface' : 'bg-bg-secondary opacity-50'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isToday(day) ? 'bg-accent text-white' : 'text-text-secondary'
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((node) => {
                  const event = node.data as unknown as EventData
                  return (
                    <div
                      key={node.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ background: event.color || 'var(--color-node-event)' }}
                    >
                      {event.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-text-muted">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
