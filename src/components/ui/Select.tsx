import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
  color?: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  className?: string
}

export function Select({ value, options, onChange, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-bg-tertiary rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer transition-colors hover:bg-bg-hover w-full"
        style={{ color: selected?.color }}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-text-muted" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-full bg-surface border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-bg-hover',
                opt.value === value ? 'text-accent bg-accent/10' : 'text-text-secondary',
              )}
              style={{ color: opt.value === value ? undefined : opt.color }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
