import { create } from 'zustand'
import { themes, type Theme } from '@/lib/themes'

const STORAGE_KEY = 'flowstate-theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value)
  }
}

interface ThemeState {
  currentThemeId: string
  setTheme: (id: string) => void
  getThemes: () => Theme[]
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentThemeId: localStorage.getItem(STORAGE_KEY) || 'dark',

  setTheme: (id: string) => {
    const theme = themes.find((t) => t.id === id)
    if (!theme) return
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, id)
    set({ currentThemeId: id })
  },

  getThemes: () => themes,

  initTheme: () => {
    const id = localStorage.getItem(STORAGE_KEY) || 'dark'
    const theme = themes.find((t) => t.id === id) || themes[0]
    applyTheme(theme)
    set({ currentThemeId: theme.id })
  },
}))
