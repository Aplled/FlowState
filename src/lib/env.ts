/**
 * Runtime environment detection. The app ships as both a Tauri desktop
 * binary and a Vercel-hosted web build, and a handful of features only
 * work in the Tauri context — `invoke` calls that reach into Rust, the
 * embedded Chromium webview BrowserNode, etc. Everything else should
 * behave identically in both.
 *
 * Keep the check synchronous and cheap so it can be read inline in
 * render paths without a ref.
 */

export const isTauri: boolean =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
