import { supabase } from './supabase'

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

/**
 * Links a Google identity (with calendar scopes) to the currently signed-in
 * user, or signs in fresh if no session exists.
 *
 * The distinction matters: `signInWithOAuth` is a sign-in flow and does not
 * reliably persist `provider_refresh_token` onto an existing user's
 * `identity_data`, which is where the `google-calendar-proxy` edge function
 * reads it from. `linkIdentity` is the identity-link flow and does persist
 * the refresh token onto the current user — but it requires "Allow manual
 * linking" to be enabled on the Supabase project.
 */
export async function signInWithGoogle() {
  const { data: { user } } = await supabase.auth.getUser()
  const options = {
    scopes: CALENDAR_SCOPES.join(' '),
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  }
  if (user) {
    const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options })
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options })
  if (error) throw error
  return data
}

/**
 * Persists a fresh Google `provider_refresh_token` server-side.
 *
 * Supabase intentionally does NOT store provider refresh tokens server-side
 * — they're only exposed on the Session briefly after the OAuth callback.
 * So we capture them here and POST to `google-calendar-proxy`, which
 * upserts into `user_oauth_tokens`. Subsequent calendar calls read the
 * token from that table via service role.
 *
 * Idempotent: posting the same token twice is safe.
 */
export async function persistGoogleRefreshToken(refreshToken: string) {
  const { error } = await supabase.functions.invoke('google-calendar-proxy', {
    body: { action: 'storeRefreshToken', refreshToken },
  })
  if (error) throw error
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
