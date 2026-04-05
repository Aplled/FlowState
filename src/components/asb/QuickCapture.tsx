import { useCallback, useEffect, useRef, useState } from 'react'
import { useASBStore } from '@/stores/asb-store'
import { CheckSquare, StickyNote, Calendar, X } from 'lucide-react'
import type { NodeType } from '@/types/database'

type CaptureType = 'task' | 'note' | 'event'

const typeOptions: { type: CaptureType; icon: React.ReactNode; label: string }[] = [
  { type: 'note', icon: <StickyNote className="h-4 w-4" />, label: 'Note' },
  { type: 'task', icon: <CheckSquare className="h-4 w-4" />, label: 'Task' },
  { type: 'event', icon: <Calendar className="h-4 w-4" />, label: 'Event' },
]

function detectType(text: string): CaptureType {
  const trimmed = text.trimStart()
  if (/^-\s*\[\s*\]/.test(trimmed) || /^todo\b/i.test(trimmed)) return 'task'
  // Simple date detection
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(text) || /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i.test(text)) return 'event'
  return 'note'
}

function buildNodeData(type: CaptureType, text: string) {
  switch (type) {
    case 'task': {
      const title = text.replace(/^-\s*\[\s*\]\s*/, '').replace(/^todo\s*/i, '').trim() || 'New Task'
      return { title, status: 'todo', priority: 'none', tags: [] }
    }
    case 'event': {
      return {
        title: text.trim() || 'New Event',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        all_day: false,
      }
    }
    case 'note':
    default:
      return { content: text.trim() }
  }
}

export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [nodeType, setNodeType] = useState<CaptureType>('note')
  const inputRef = useRef<HTMLInputElement>(null)
  const addToASB = useASBStore((s) => s.addToASB)

  const handleOpen = useCallback(() => {
    setOpen(true)
    setText('')
    setNodeType('note')
    // Focus after render
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setText('')
  }, [])

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return
    const finalType = nodeType
    addToASB({
      type: finalType as NodeType,
      data: buildNodeData(finalType, text),
    })
    handleClose()
  }, [text, nodeType, addToASB, handleClose])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault()
        if (open) handleClose()
        else handleOpen()
      }
      if (e.key === 'Escape' && open) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleOpen, handleClose])

  // Auto-detect type as user types
  useEffect(() => {
    if (text.length > 2) {
      setNodeType(detectType(text))
    }
  }, [text])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-1 shrink-0">
            {typeOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setNodeType(opt.type)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  nodeType === opt.type
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text hover:bg-bg-hover'
                }`}
                title={opt.label}
              >
                {opt.icon}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="Quick capture... (Enter to add)"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/50 outline-none"
            autoFocus
          />

          <button
            onClick={handleClose}
            className="p-1 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hint bar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-bg-hover/30 border-t border-border/50 text-[10px] text-text-muted">
          <span>Type detected: <span className="text-accent font-medium">{nodeType}</span></span>
          <span className="ml-auto">
            <kbd className="px-1 py-0.5 rounded bg-bg-hover font-mono">Enter</kbd> to add
            <span className="mx-1.5">·</span>
            <kbd className="px-1 py-0.5 rounded bg-bg-hover font-mono">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
