import { useMemo, useState } from 'react'
import { useNodeStore } from '@/stores/node-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EventData, TaskData } from '@/types/database'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'

interface CalendarItem {
  id: string
  title: string
  date: Date
  color: string
  type: 'event' | 'task-due'
}

export function CalendarView() {
  const allNodes = useNodeStore((s) => s.allNodes)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const items = useMemo<CalendarItem[]>(() => {
    const result: CalendarItem[] = []
    for (const n of allNodes) {
      if (n.type === 'event') {
        const data = n.data as unknown as EventData
        if (data.start_time) {
          result.push({ id: n.id, title: data.title, date: new Date(data.start_time), color: '#f472b6', type: 'event' })
        }
      }
      if (n.type === 'task') {
        const data = n.data as unknown as TaskData
        if (data.due_date) {
          result.push({ id: n.id, title: data.title, date: new Date(data.due_date), color: '#f59e0b', type: 'task-due' })
        }
      }
    }
    return result
  }, [allNodes])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getItemsForDay = (day: Date) => items.filter((item) => isSameDay(item.date, day))

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text">Calendar</h1>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded hover:bg-bg-hover cursor-pointer text-text-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-text min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-bg-hover cursor-pointer text-text-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-2 py-0.5 text-xs text-text-muted hover:text-text bg-bg-tertiary rounded cursor-pointer ml-2"
          >
            Today
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-text-muted py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
        {days.map((day) => {
          const dayItems = getItemsForDay(day)
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className={`border-b border-r border-border p-1 min-h-0 overflow-hidden ${!inMonth ? 'opacity-30' : ''}`}
            >
              <div className={`text-[10px] mb-0.5 ${today ? 'text-accent font-bold' : 'text-text-muted'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="text-[9px] truncate rounded px-1 py-0.5"
                    style={{ background: item.color + '20', color: item.color }}
                  >
                    {item.title}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-[9px] text-text-muted">+{dayItems.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
