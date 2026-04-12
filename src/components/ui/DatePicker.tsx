import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string // ISO date string or YYYY-MM-DD
  onChange: (value: string | undefined) => void
  className?: string
  placeholder?: string
  outputFormat?: 'iso' | 'date-only' // 'date-only' outputs YYYY-MM-DD
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function DatePicker({ value, onChange, className, placeholder = 'Set date', outputFormat = 'iso' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value) : null
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth())

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    }
  }, [open])

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startDay = first.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < startDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    if (outputFormat === 'date-only') {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      onChange(`${y}-${m}-${dd}`)
    } else {
      onChange(d.toISOString())
    }
    setOpen(false)
  }

  const isSelected = (day: number) => {
    if (!selected) return false
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day
  }

  const isToday = (day: number) => {
    const now = new Date()
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day
  }

  const displayValue = selected
    ? `${MONTHS[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
    : null

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-bg-tertiary rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer transition-colors hover:bg-bg-hover"
      >
        <Calendar className="h-3 w-3 text-text-muted shrink-0" />
        <span className={cn('truncate', displayValue ? 'text-text-secondary' : 'text-text-muted')}>
          {displayValue ?? placeholder}
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-surface border border-border rounded-xl shadow-lg p-3 w-[220px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors text-text-muted hover:text-text">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium text-text">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors text-text-muted hover:text-text">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-[10px] text-text-muted text-center py-0.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {day && (
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      'w-full h-full rounded-lg text-[11px] cursor-pointer transition-colors',
                      isSelected(day)
                        ? 'bg-accent text-white'
                        : isToday(day)
                          ? 'bg-accent/15 text-accent hover:bg-accent/25'
                          : 'text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(undefined); setOpen(false) }}
              className="mt-2 w-full text-[10px] text-danger/70 hover:text-danger cursor-pointer transition-colors text-center py-1 rounded-lg hover:bg-danger/10"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
