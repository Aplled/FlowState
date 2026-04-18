/**
 * Central HTML sanitizer for anything user-editable that we later render with
 * `dangerouslySetInnerHTML` or hand to Tiptap's `setContent`. Node descriptions
 * and doc bodies are stored as HTML strings in Supabase and synced across
 * devices, so a single unsanitized row can become stored XSS on every client
 * that opens the workspace.
 *
 * Sanitize on BOTH write (so we never persist a payload) and read (so existing
 * rows from before this module landed get cleaned up on the fly).
 */

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'sub', 'sup', 's',
  'blockquote', 'u', 'ul', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

const ALLOWED_ATTR = ['href', 'title', 'class', 'style', 'target', 'rel', 'alt', 'src', 'colspan', 'rowspan', 'data-type', 'data-checked']

// Only http(s) and mailto links survive. Blocks javascript:, data:, vbscript:,
// file:, etc. Note: `img src` uses the same regex in DOMPurify v3, so data: URI
// images are also rejected — that's intentional, we don't support inline images.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    // Defense in depth: even if a tag slips through, these hooks are always
    // stripped. DOMPurify strips them by default, but declaring explicitly
    // makes the intent obvious.
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'formaction'],
  })
}
