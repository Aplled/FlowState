import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value?: string // HH:MM format
  onChange: (value: string) => void
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

function formatTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && listRef.current && value) {
      const active = listRef.current.querySelector('[data-active="true"]')
      if (active) active.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const displayValue = value
    ? (() => {
        const [h, m] = value.split(':').map(Number)
        return formatTime(h, m)
      })()
    : null

  const times = HOURS.flatMap((h) => MINUTES.map((m) => ({ h, m, key: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })))

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-bg-tertiary rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer transition-colors hover:bg-bg-hover"
      >
        <Clock className="h-3 w-3 text-text-muted shrink-0" />
        <span className={cn('truncate', displayValue ? 'text-text-secondary' : 'text-text-muted')}>
          {displayValue ?? 'Set time'}
        </span>
      </button>
      {open && (
        <div ref={listRef} className="absolute z-50 mt-1 bg-surface border border-border rounded-xl shadow-lg py-1 w-[120px] max-h-48 overflow-auto">
          {times.map(({ h, m, key }) => (
            <button
              key={key}
              type="button"
              data-active={key === value}
              onClick={() => { onChange(key); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-bg-hover',
                key === value ? 'text-accent bg-accent/10' : 'text-text-secondary',
              )}
            >
              {formatTime(h, m)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
