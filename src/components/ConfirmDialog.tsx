import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-80 p-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 bg-danger/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-danger hover:bg-danger/80 cursor-pointer transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
