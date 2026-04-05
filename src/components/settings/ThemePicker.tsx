import { useThemeStore } from '@/stores/theme-store'
import { Check } from 'lucide-react'

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const currentThemeId = useThemeStore((s) => s.currentThemeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const allThemes = useThemeStore((s) => s.getThemes())

  return (
    <div className="absolute bottom-10 left-2 z-50 w-52 rounded-lg border border-border bg-surface shadow-xl p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Theme</div>
      <div className="grid grid-cols-2 gap-2">
        {allThemes.map((theme) => {
          const active = theme.id === currentThemeId
          const c = theme.colors
          return (
            <button
              key={theme.id}
              onClick={() => { setTheme(theme.id); onClose() }}
              className={`relative rounded-md border p-2 cursor-pointer transition hover:border-accent ${
                active ? 'border-accent ring-1 ring-accent' : 'border-border'
              }`}
            >
              {/* Color swatches */}
              <div className="flex gap-0.5 mb-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: c['--color-bg'] }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: c['--color-surface'] }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: c['--color-accent'] }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: c['--color-text'] }} />
              </div>
              <div className="text-[10px] text-text-secondary truncate">{theme.name}</div>
              {active && (
                <div className="absolute top-1 right-1">
                  <Check className="h-3 w-3 text-accent" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
