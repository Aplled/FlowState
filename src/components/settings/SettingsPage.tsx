import { useState, useMemo } from 'react'
import { useThemeStore } from '@/stores/theme-store'
import { useLayoutStore, type SidebarPosition } from '@/stores/layout-store'
import { colorLabels, colorGroups, builtinThemes, type Theme } from '@/lib/themes'
import {
  Palette, Layout, Monitor, Keyboard, Calendar, Trash2, Copy, Plus, Check, ChevronRight,
  PanelLeft, PanelRight, Eye, EyeOff, Map, Rows3, Minimize2,
} from 'lucide-react'
import { CalendarSettings } from '@/components/settings/CalendarSettings'
import { cn } from '@/lib/utils'

type SettingsSection = 'appearance' | 'layout' | 'editor' | 'shortcuts' | 'calendar'

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('appearance')

  const sections = [
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'layout' as const, label: 'Layout', icon: Layout },
    { id: 'editor' as const, label: 'Editor', icon: Monitor },
    { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
    { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
  ]

  return (
    <div className="h-full flex bg-bg overflow-hidden">
      {/* Settings sidebar */}
      <div className="w-52 border-r border-border bg-bg-secondary shrink-0 py-4">
        <div className="px-4 mb-4">
          <h1 className="text-lg font-semibold text-text">Settings</h1>
          <p className="text-xs text-text-muted mt-1">Customize your workspace</p>
        </div>
        <nav className="space-y-0.5 px-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors',
                section === s.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text',
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-8">
          {section === 'appearance' && <AppearanceSettings />}
          {section === 'layout' && <LayoutSettings />}
          {section === 'editor' && <EditorSettings />}
          {section === 'calendar' && <CalendarSettingsSection />}
          {section === 'shortcuts' && <ShortcutsSettings />}
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50">
      <div>
        <div className="text-sm text-text">{label}</div>
        {description && <div className="text-xs text-text-muted mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors cursor-pointer',
        checked ? 'bg-accent' : 'bg-bg-active',
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  )
}

function AppearanceSettings() {
  const currentThemeId = useThemeStore((s) => s.currentThemeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const customThemes = useThemeStore((s) => s.customThemes)
  const allThemes = useMemo(() => [...builtinThemes, ...customThemes], [customThemes])
  const createCustomTheme = useThemeStore((s) => s.createCustomTheme)
  const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme)
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme)
  const updateThemeColor = useThemeStore((s) => s.updateThemeColor)
  const updateCustomTheme = useThemeStore((s) => s.updateCustomTheme)

  const [editingTheme, setEditingTheme] = useState<string | null>(null)
  const editTheme = editingTheme ? allThemes.find((t) => t.id === editingTheme) : null

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Appearance</h2>
      <p className="text-sm text-text-muted mb-6">Customize colors, fonts, and visual style</p>

      {/* Theme gallery */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text">Themes</h3>
          <button
            onClick={() => {
              const t = createCustomTheme('My Theme')
              setEditingTheme(t.id)
            }}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover cursor-pointer transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Theme
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {allThemes.map((theme) => {
            const active = theme.id === currentThemeId
            const c = theme.colors
            return (
              <div
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={cn(
                  'relative rounded-xl border p-3 cursor-pointer transition-all text-left group',
                  active ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/50',
                )}
              >
                {/* Preview bar */}
                <div className="flex gap-1.5 mb-2">
                  <div className="flex-1 h-6 rounded-md" style={{ background: c['--color-bg'] }}>
                    <div className="h-full w-1/3 rounded-l-md" style={{ background: c['--color-bg-secondary'] }} />
                  </div>
                </div>
                <div className="flex gap-1 mb-2">
                  {['--color-accent', '--color-success', '--color-warning', '--color-danger'].map((k) => (
                    <div key={k} className="w-4 h-4 rounded-full border border-border/30" style={{ background: c[k] }} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">{theme.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-accent" />}
                </div>

                {/* Actions for custom themes */}
                {theme.isCustom && (
                  <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTheme(theme.id) }}
                      className="p-1 rounded-md bg-bg-hover text-text-muted hover:text-text cursor-pointer"
                      title="Edit"
                    >
                      <Palette className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCustomTheme(theme.id) }}
                      className="p-1 rounded-md bg-bg-hover text-text-muted hover:text-danger cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {!theme.isCustom && (
                  <div className="absolute top-1.5 right-1.5 hidden group-hover:flex">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const t = duplicateTheme(theme.id)
                        setEditingTheme(t.id)
                      }}
                      className="p-1 rounded-md bg-bg-hover text-text-muted hover:text-text cursor-pointer"
                      title="Duplicate & Customize"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom theme editor */}
      {editTheme && editTheme.isCustom && (
        <div className="border border-border rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-text">Editing: </h3>
              <input
                value={editTheme.name}
                onChange={(e) => updateCustomTheme(editTheme.id, { name: e.target.value })}
                className="bg-bg-tertiary rounded-lg px-2.5 py-1 text-sm text-text outline-none ring-1 ring-border focus:ring-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setTheme(editTheme.id); }}
                className="text-xs text-accent hover:text-accent-hover cursor-pointer"
              >
                Apply
              </button>
              <button
                onClick={() => setEditingTheme(null)}
                className="text-xs text-text-muted hover:text-text cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>

          {Object.entries(colorGroups).map(([group, keys]) => (
            <div key={group} className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{group}</h4>
              <div className="grid grid-cols-2 gap-2">
                {keys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editTheme.colors[key]?.replace(/[0-9a-f]{2}$/i, '') || '#000000'}
                      onChange={(e) => updateThemeColor(editTheme.id, key, e.target.value)}
                      className="w-7 h-7 rounded-lg border border-border cursor-pointer"
                    />
                    <span className="text-xs text-text-secondary">{colorLabels[key] || key}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LayoutSettings() {
  const {
    sidebarPosition, setSidebarPosition,
    sidebarWidth, setSidebarWidth,
    showMinimap, setShowMinimap,
    showBreadcrumbs, setShowBreadcrumbs,
    showTabBar, setShowTabBar,
    compactNodeHeaders, setCompactNodeHeaders,
    compactMode, setCompactMode,
  } = useLayoutStore()

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Layout</h2>
      <p className="text-sm text-text-muted mb-6">Arrange panels and customize the workspace layout</p>

      <SettingRow label="Sidebar Position" description="Place the sidebar on the left or right">
        <div className="flex gap-1">
          {(['left', 'right'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setSidebarPosition(pos)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors',
                sidebarPosition === pos ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-muted hover:text-text',
              )}
            >
              {pos === 'left' ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
              {pos.charAt(0).toUpperCase() + pos.slice(1)}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Sidebar Width" description={`${sidebarWidth}px`}>
        <input
          type="range"
          min={180}
          max={400}
          value={sidebarWidth}
          onChange={(e) => setSidebarWidth(Number(e.target.value))}
          className="w-32 accent-accent cursor-pointer"
        />
      </SettingRow>

      <SettingRow label="Show Minimap" description="Show the canvas minimap">
        <Toggle checked={showMinimap} onChange={setShowMinimap} />
      </SettingRow>

      <SettingRow label="Show Breadcrumbs" description="Show navigation breadcrumbs">
        <Toggle checked={showBreadcrumbs} onChange={setShowBreadcrumbs} />
      </SettingRow>

      <SettingRow label="Show Tab Bar" description="Show the tab bar at the top">
        <Toggle checked={showTabBar} onChange={setShowTabBar} />
      </SettingRow>

      <SettingRow label="Compact Node Headers" description="Only show icon in node header — title lives in the body">
        <Toggle checked={compactNodeHeaders} onChange={setCompactNodeHeaders} />
      </SettingRow>

      <SettingRow label="Compact Mode" description="Reduce padding and spacing throughout the UI">
        <Toggle checked={compactMode} onChange={setCompactMode} />
      </SettingRow>
    </div>
  )
}

function EditorSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Editor</h2>
      <p className="text-sm text-text-muted mb-6">Configure the text editor behavior</p>

      <SettingRow label="Slash Commands" description="Type / to open the block menu">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>

      <SettingRow label="Spell Check" description="Enable browser spell checking">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>

      <SettingRow label="Auto-save" description="Automatically save changes">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>

      <SettingRow label="Vim Mode" description="Enable Vim keybindings in the editor">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
    </div>
  )
}

function CalendarSettingsSection() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Calendar Sync</h2>
      <p className="text-sm text-text-muted mb-6">Connect and sync with Google Calendar</p>
      <div className="border border-border rounded-xl overflow-hidden">
        <CalendarSettings />
      </div>
    </div>
  )
}

function ShortcutsSettings() {
  const shortcuts = [
    { keys: ['Cmd', 'K'], action: 'Command palette' },
    { keys: ['Cmd', 'N'], action: 'New page' },
    { keys: ['Cmd', 'Shift', 'N'], action: 'New workspace' },
    { keys: ['Cmd', '/'], action: 'Toggle sidebar' },
    { keys: ['Delete'], action: 'Delete selected nodes' },
    { keys: ['Shift', 'Click'], action: 'Marquee select' },
    { keys: ['Scroll'], action: 'Zoom canvas' },
    { keys: ['Middle Click'], action: 'Pan canvas' },
    { keys: ['Right Click'], action: 'Context menu' },
  ]

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Keyboard Shortcuts</h2>
      <p className="text-sm text-text-muted mb-6">Quick reference for all shortcuts</p>

      <div className="space-y-1">
        {shortcuts.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/30">
            <span className="text-sm text-text">{s.action}</span>
            <div className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="px-2 py-0.5 text-[11px] text-text-secondary bg-bg-tertiary border border-border rounded-md">
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
