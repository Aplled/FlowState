import { useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext, isSupabaseConfigured } from '@/lib/auth'
import * as auth from '@/lib/auth'
import { isGoogleConnected, persistGoogleRefreshToken } from '@/lib/google-auth'
import { fetchGoogleCalendars } from '@/services/calendar-sync'
import { syncFromGoogle, startPeriodicSync, stopPeriodicSync } from '@/services/sync-engine'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'

async function bootstrapGoogleSync() {
  try {
    const connected = await isGoogleConnected()
    const store = useCalendarSyncStore.getState()
    store.setConnected(connected)
    if (!connected) return

    const cals = await fetchGoogleCalendars()
    store.setCalendars(cals)
    if (!store.selectedCalendarId) {
      const primary = cals.find((c) => c.primary)
      if (primary) store.setSelectedCalendar(primary.id)
    }

    await syncFromGoogle()
    if (store.syncFrequencyMs > 0) startPeriodicSync(store.syncFrequencyMs)
  } catch (err) {
    console.error('Google sync bootstrap failed:', err)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    auth.getCurrentUser().then((u) => {
      setUser(u)
      setLoading(false)
      if (u) bootstrapGoogleSync()
    })

    const subscription = auth.onAuthStateChange(async (u, session) => {
      setUser(u)
      setLoading(false)
      if (u) {
        // `provider_refresh_token` is only present on the Session right after
        // the OAuth callback — capture it before bootstrapping, so the first
        // calendar call succeeds instead of 409-ing on a missing token row.
        if (session?.provider_refresh_token) {
          try {
            await persistGoogleRefreshToken(session.provider_refresh_token)
          } catch (err) {
            console.error('failed to persist google refresh token:', err)
          }
        }
        bootstrapGoogleSync()
      } else {
        stopPeriodicSync()
        useCalendarSyncStore.getState().clearGoogleEvents()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const data = await auth.signIn(email, password)
    setUser(data.user)
  }, [])

  const handleSignUp = useCallback(async (email: string, password: string, displayName: string) => {
    await auth.signUp(email, password, displayName)
  }, [])

  const handleSignOut = useCallback(async () => {
    await auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn: handleSignIn, signUp: handleSignUp, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
