import { useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext, isSupabaseConfigured } from '@/lib/auth'
import * as auth from '@/lib/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Check current session
    auth.getCurrentUser().then((u) => {
      setUser(u)
      setLoading(false)
    })

    // Listen for changes
    const subscription = auth.onAuthStateChange((u) => {
      setUser(u)
      setLoading(false)
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
