import { supabase } from './supabase'

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

/**
 * Triggers Google OAuth flow via Supabase, requesting calendar scopes.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: CALENDAR_SCOPES.join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) throw error
  return data
}

/**
 * Retrieves the Google provider access token from the current Supabase session.
 * Returns null if no session or no provider token.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token ?? null
}

/**
 * Checks whether the current user has a Google provider linked.
 */
export async function isGoogleConnected(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const hasProvider = user.app_metadata?.providers?.includes('google') ?? false
  if (!hasProvider) return false
  // Also need a live provider_token to actually call Google APIs
  const token = await getGoogleAccessToken()
  return token != null
}

/**
 * Unlinks the Google identity from the current user without signing them out.
 * Falls back to a no-op if the identity isn't found.
 */
export async function disconnectGoogle() {
  const { data, error: idErr } = await supabase.auth.getUserIdentities()
  if (idErr) throw idErr
  const googleIdentity = data?.identities?.find((i) => i.provider === 'google')
  if (googleIdentity) {
    const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
    if (error) throw error
  }
}
