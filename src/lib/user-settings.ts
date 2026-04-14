import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type UserSettings = Record<string, unknown>

let cache: UserSettings = {}
let userId: string | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export async function hydrateUserSettings(id: string): Promise<UserSettings> {
  if (!isSupabaseConfigured) return {}
  userId = id
  const { data, error } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', id)
    .single()
  if (error || !data) {
    cache = {}
    return {}
  }
  cache = ((data as { settings: UserSettings }).settings) || {}
  return cache
}

export function patchUserSettings(partial: UserSettings) {
  cache = { ...cache, ...partial }
  if (!userId || !isSupabaseConfigured) return
  if (saveTimer) clearTimeout(saveTimer)
  const snapshot = cache
  const id = userId
  saveTimer = setTimeout(async () => {
    saveTimer = null
    const { error } = await supabase
      .from('profiles')
      .update({ settings: snapshot })
      .eq('id', id)
    if (error) console.error('profile settings save failed', error)
  }, 600)
}

export function clearUserSettings() {
  userId = null
  cache = {}
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}
