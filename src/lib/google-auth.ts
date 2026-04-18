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
 * Checks whether the current user has a Google provider linked.
 *
 * Previously this also probed for a live `provider_token` in the client
 * session, because the client used to call Google APIs directly and needed
 * that token to be present. Now all Google API calls go through the
 * `google-calendar-proxy` edge function, which sources the token server-side
 * from `auth.identities`. So here we only need to know whether the user has
 * linked a Google identity at all.
 */
export async function isGoogleConnected(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return user.app_metadata?.providers?.includes('google') ?? false
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
