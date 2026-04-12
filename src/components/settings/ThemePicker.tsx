import { useMemo } from 'react'
import { useThemeStore } from '@/stores/theme-store'
import { builtinThemes } from '@/lib/themes'
import { Check } from 'lucide-react'

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const currentThemeId = useThemeStore((s) => s.currentThemeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const customThemes = useThemeStore((s) => s.customThemes)
  const allThemes = useMemo(() => [...builtinThemes, ...customThemes], [customThemes])

  return (
    <div className="absolute bottom-10 left-2 z-50 w-56 rounded-xl border border-border bg-surface shadow-lg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Theme</div>
      <div className="grid grid-cols-2 gap-2">
        {allThemes.map((theme) => {
          const active = theme.id === currentThemeId
          const c = theme.colors
          return (
            <button
              key={theme.id}
              onClick={() => { setTheme(theme.id); onClose() }}
              className={`relative rounded-xl border p-2.5 cursor-pointer transition-all hover:border-accent ${
                active ? 'border-accent ring-1 ring-accent' : 'border-border'
              }`}
            >
              <div className="flex gap-1 mb-1.5">
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: c['--color-bg'] }} />
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: c['--color-surface'] }} />
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: c['--color-accent'] }} />
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: c['--color-text'] }} />
              </div>
              <div className="text-[10px] text-text-secondary truncate">{theme.name}</div>
              {active && (
                <div className="absolute top-1.5 right-1.5">
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
