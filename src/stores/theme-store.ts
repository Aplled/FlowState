import { create } from 'zustand'
import { builtinThemes, type Theme } from '@/lib/themes'
import { nanoid } from 'nanoid'

const STORAGE_KEY = 'flowstate-theme'
const CUSTOM_THEMES_KEY = 'flowstate-custom-themes'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value)
  }
}

function loadCustomThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCustomThemes(themes: Theme[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
}

interface ThemeState {
  currentThemeId: string
  customThemes: Theme[]

  setTheme: (id: string) => void
  getThemes: () => Theme[]
  getAllThemes: () => Theme[]
  initTheme: () => void

  createCustomTheme: (name: string, baseThemeId?: string) => Theme
  updateCustomTheme: (id: string, updates: Partial<Pick<Theme, 'name' | 'colors'>>) => void
  deleteCustomTheme: (id: string) => void
  duplicateTheme: (id: string) => Theme
  updateThemeColor: (themeId: string, colorKey: string, value: string) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentThemeId: localStorage.getItem(STORAGE_KEY) || 'notion-dark',
  customThemes: loadCustomThemes(),

  setTheme: (id: string) => {
    const all = [...builtinThemes, ...get().customThemes]
    const theme = all.find((t) => t.id === id)
    if (!theme) return
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, id)
    set({ currentThemeId: id })
  },

  getThemes: () => builtinThemes,
  getAllThemes: () => builtinThemes,

  initTheme: () => {
    const id = localStorage.getItem(STORAGE_KEY) || 'notion-dark'
    const all = [...builtinThemes, ...get().customThemes]
    const theme = all.find((t) => t.id === id) || builtinThemes[0]
    applyTheme(theme)
    set({ currentThemeId: theme.id })
  },

  createCustomTheme: (name, baseThemeId) => {
    const all = [...builtinThemes, ...get().customThemes]
    const base = baseThemeId ? all.find((t) => t.id === baseThemeId) : builtinThemes[0]
    const theme: Theme = {
      id: `custom-${nanoid(8)}`,
      name,
      colors: { ...(base?.colors ?? builtinThemes[0].colors) },
      isCustom: true,
    }
    const next = [...get().customThemes, theme]
    saveCustomThemes(next)
    set({ customThemes: next })
    return theme
  },

  updateCustomTheme: (id, updates) => {
    const next = get().customThemes.map((t) =>
      t.id === id ? { ...t, ...updates } : t,
    )
    saveCustomThemes(next)
    set({ customThemes: next })
    // If currently active, re-apply
    if (get().currentThemeId === id) {
      const theme = next.find((t) => t.id === id)
      if (theme) applyTheme(theme)
    }
  },

  deleteCustomTheme: (id) => {
    const next = get().customThemes.filter((t) => t.id !== id)
    saveCustomThemes(next)
    // If deleting the active theme, switch to default
    if (get().currentThemeId === id) {
      const fallback = builtinThemes[0]
      applyTheme(fallback)
      localStorage.setItem(STORAGE_KEY, fallback.id)
      set({ customThemes: next, currentThemeId: fallback.id })
    } else {
      set({ customThemes: next })
    }
  },

  duplicateTheme: (id) => {
    const all = get().getAllThemes()
    const source = all.find((t) => t.id === id)
    if (!source) return builtinThemes[0]
    return get().createCustomTheme(`${source.name} Copy`, id)
  },

  updateThemeColor: (themeId, colorKey, value) => {
    const theme = get().customThemes.find((t) => t.id === themeId)
    if (!theme) return
    const colors = { ...theme.colors, [colorKey]: value }
    get().updateCustomTheme(themeId, { colors })
  },
}))
