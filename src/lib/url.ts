/**
 * URL helpers for anywhere we navigate, open, or pass a user-supplied URL to
 * a Tauri webview / `window.open`. The Rust side gates these again, but doing
 * it on the client too gives users immediate feedback and avoids round-trips.
 */

/**
 * Parse a user-supplied string and return a safe http/https URL, or null if
 * the input can't be made into one. Accepts bare hosts like `github.com` and
 * defaults them to https.
 *
 * Blocks javascript:, data:, file:, vbscript:, and anything else non-http(s).
 */
export function safeHttpUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // If there's no scheme, default to https. Don't use a regex that would
  // match inside the string — we only care about the very start.
  const withScheme = /^[a-z][a-z0-9+.\-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}
