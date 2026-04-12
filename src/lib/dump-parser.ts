import type { NodeType, Json } from '@/types/database'
import nlp from 'compromise'

export interface ParsedSegment {
  text: string
  type: NodeType
  data: Json
  tags: string[]
}

export interface RawSegment {
  text: string
  tags: string[]
}

const TASK_PREFIXES = /^(\s*[-*]\s*\[\s?\]\s*|todo[:\s]+|task[:\s]+|\[\s?\]\s*)/i
const TASK_VERBS = /^(do|make|finish|complete|build|write|send|email|call|fix|update|create|review|read|buy|get|schedule|book|prepare|draft|ship|deploy|test|check|ask|tell|remind|setup|set up|plan|organize|clean|refactor|implement|add|study|practice|submit|turn in|hand in|pay|renew|return)\b/i
const TASK_PHRASES = /\b(need to|have to|should|must|remember to|don'?t forget|gotta|due|deadline|by tomorrow|by tonight|by monday|by tuesday|by wednesday|by thursday|by friday|by saturday|by sunday|by next|before tomorrow|before next)\b/i
const URL_RE = /^https?:\/\/\S+/i
const HASHTAG_RE = /#([a-z0-9_-]+)/gi
const TIME_RE = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/i
const DATE_WORDS = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i
const DATE_NUMERIC = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/
const REL_DATE_RE = /\bin\s+(\d+)\s+(hour|day|week|month)s?\b/i
const EVENT_PHRASES = /\b(meeting|call with|appointment|lunch with|dinner with|interview|standup|sync|1:1|demo|flight|class with)\b/i

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','have','has','had','was','were','will','would','could','should','about','into','your','their','they','them','our','you','are','but','not','all','any','can','out','one','two','its','it\'s','also','than','then','just','some','more','very','too','here','there','what','when','where','who','how','why','because','been','being','over','under','off','onto','upon','per','via','let','make','need','want','get','got','use'
])

export function detectType(text: string): NodeType {
  const trimmed = text.trim()
  if (URL_RE.test(trimmed)) return 'browser'
  if (TASK_PREFIXES.test(trimmed)) return 'task'

  // Task signals fire BEFORE event signals because "due / deadline / by friday"
  // are almost always tasks with a deadline, not calendar events.
  const stripped = trimmed.replace(TASK_PREFIXES, '')
  const hasTaskSignal = TASK_PHRASES.test(trimmed) || TASK_VERBS.test(stripped)
  if (hasTaskSignal) return 'task'

  // Event = explicit event phrase + a time-of-day, or event phrase + a date.
  const hasTime = TIME_RE.test(trimmed)
  const hasDate = DATE_WORDS.test(trimmed) || DATE_NUMERIC.test(trimmed) || REL_DATE_RE.test(trimmed)
  const hasEventPhrase = EVENT_PHRASES.test(trimmed)
  if (hasEventPhrase && (hasTime || hasDate)) return 'event'

  return 'note'
}

function extractTags(text: string): string[] {
  const tags: string[] = []
  let m: RegExpExecArray | null
  HASHTAG_RE.lastIndex = 0
  while ((m = HASHTAG_RE.exec(text)) !== null) tags.push(m[1].toLowerCase())
  return Array.from(new Set(tags))
}

function extractKeywords(text: string, max = 3): string[] {
  const words = text
    .toLowerCase()
    .replace(HASHTAG_RE, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w)
}

/** Parse a date/time hint into an ISO timestamp, or null if no hint found. */
function guessDateTime(text: string): string | null {
  const now = new Date()
  const lower = text.toLowerCase()
  const target = new Date(now)
  let matched = false

  // "in N days/weeks/hours/months"
  const rel = lower.match(REL_DATE_RE)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    if (unit === 'hour') target.setHours(target.getHours() + n)
    else if (unit === 'day') target.setDate(target.getDate() + n)
    else if (unit === 'week') target.setDate(target.getDate() + n * 7)
    else if (unit === 'month') target.setMonth(target.getMonth() + n)
    matched = true
  }

  // Day-of-week
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const dayIdx = days.findIndex((d) => lower.includes(d))
  if (dayIdx >= 0) {
    const diff = (dayIdx - now.getDay() + 7) % 7 || 7
    target.setDate(now.getDate() + diff)
    matched = true
  } else if (lower.includes('tomorrow')) {
    target.setDate(now.getDate() + 1)
    matched = true
  } else if (lower.includes('tonight')) {
    target.setHours(19, 0, 0, 0)
    return target.toISOString()
  } else if (lower.includes('today')) {
    matched = true
  }

  if (!matched && !TIME_RE.test(lower)) return null

  // Time
  const tm = lower.match(/(\d{1,2})(?::(\d{2}))?\s?(am|pm)?/)
  if (tm) {
    let h = parseInt(tm[1], 10)
    const min = tm[2] ? parseInt(tm[2], 10) : 0
    const mer = tm[3]
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) target.setHours(h, min, 0, 0)
  } else if (!rel) {
    target.setHours(9, 0, 0, 0)
  }

  return target.toISOString()
}

function guessStartTime(text: string): string {
  return guessDateTime(text) ?? new Date(Date.now() + 3600000).toISOString()
}

export function buildSegmentData(type: NodeType, text: string, tags: string[]): Json {
  const trimmed = text.trim()
  const titleLine = trimmed.split('\n')[0].slice(0, 120)

  switch (type) {
    case 'task': {
      const due = guessDateTime(trimmed)
      const task: Record<string, Json> = {
        title: trimmed.replace(TASK_PREFIXES, '').split('\n')[0].slice(0, 200),
        status: 'todo',
        priority: 'none',
        tags,
      }
      if (due) task.due_date = due
      return task
    }
    case 'event': {
      const start = guessStartTime(trimmed)
      const end = new Date(new Date(start).getTime() + 3600000).toISOString()
      return {
        title: titleLine,
        start_time: start,
        end_time: end,
        all_day: false,
        tags,
      }
    }
    case 'browser': {
      const urlMatch = trimmed.match(URL_RE)
      return {
        url: urlMatch ? urlMatch[0] : trimmed,
        title: '',
        tags,
      }
    }
    default: {
      // Derive a readable title from the first line so fallback notes
      // (LLM off / failed) don't render as blank "Note" cards. Strip bullet
      // markers, leading filler, and hashtags.
      const firstLine = trimmed
        .split('\n')[0]
        .replace(/^[\s\-*•]+/, '')
        .replace(HASHTAG_RE, '')
        .replace(/^(i\s+)?(need to|have to|should|must|remember to|gotta|thinking about|note:?|idea:?)\s+/i, '')
        .trim()
      const title = (firstLine.charAt(0).toUpperCase() + firstLine.slice(1)).slice(0, 80)
      return { title, content: trimmed, tags }
    }
  }
}

/**
 * Split a raw text dump into typed segments.
 *
 * Splitting strategy:
 *  - Blank lines always split.
 *  - Lines starting with "- ", "* ", "[ ]", "todo " split.
 *  - URLs on their own line split.
 *  - Otherwise, consecutive lines belong to the same segment (multi-line note).
 */
export function parseDump(raw: string): ParsedSegment[] {
  const text = raw.trim()
  if (!text) return []

  // Split on every newline. Each non-empty line becomes its own segment.
  // Stripping bullet markers for cleaner titles.
  const segments: string[] = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\[\s?\]\s*/, ''))

  return segments.map((seg) => {
    const type = detectType(seg)
    const tags = extractTags(seg)
    if (tags.length === 0) tags.push(...extractKeywords(seg))
    return { text: seg, type, data: buildSegmentData(type, seg, tags), tags }
  })
}

const PROJECT_HEADER_RE = /^(?:new\s+)?(?:project|idea|build|building|launch|launching|plan|initiative|feature|side\s*project)\s*(?:[:\-—]|\s+)\s*(.+)$/i
const STARTING_RE = /^(?:starting|thinking about (?:building|making|launching))\s+(.+)$/i

/** Use NLP noun-phrase extraction to pull the actual subject out of a project
 *  header. "new project thats a water bottle company" → "water bottle company".
 *  Falls back to lightly-trimmed input if nothing useful is found. */
function cleanProjectLabel(raw: string): string {
  const cleaned = raw.trim().replace(/^[:\-—]\s*/, '')
  try {
    const doc = nlp(cleaned)
    // Strip determiners, copulas, fillers — leave the noun phrase(s).
    doc.match('#Determiner').remove()
    doc.match('(thats|that is|which is|it is|its|is|was)').remove()
    doc.match('(about|called|named|for|to build|to make|to create|to launch)').remove()
    const nouns = doc.nouns().out('array') as string[]
    if (nouns.length > 0) {
      // Prefer the longest noun phrase — usually the most specific.
      const best = nouns.sort((a, b) => b.length - a.length)[0]
      if (best && best.length >= 3) return best.slice(0, 80)
    }
  } catch { /* fall through */ }
  return cleaned.slice(0, 80)
}

export interface GroupBundle {
  label: string
  children: RawSegment[]
}

/**
 * Detect if the dump describes a project / idea bundle. Returns the
 * group label + child segments, or null if it's just a flat list.
 *
 * Triggers:
 *   - First line matches "project: foo" / "idea: foo" / "building foo:" / "starting foo"
 *   - AND there's at least one additional line of content
 */
export function detectProjectGroup(text: string): GroupBundle | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null

  const first = lines[0]
  let label: string | null = null

  const m1 = first.match(PROJECT_HEADER_RE)
  if (m1) label = cleanProjectLabel(m1[1])

  if (!label) {
    const m2 = first.match(STARTING_RE)
    if (m2) label = cleanProjectLabel(m2[1])
  }

  // Heuristic: bare title followed by an indented/bulleted list
  if (!label) {
    const looksLikeTitle = first.length <= 60 && !/[.!?]$/.test(first)
    const restAreBullets = lines.slice(1).every((l) => /^[-*\[]/.test(l) || l.length < 80)
    if (looksLikeTitle && restAreBullets && lines.length >= 3) {
      // Be conservative — only fire when the title looks like a noun phrase, not a sentence
      if (!/^(i |we |the |my |a |an )/i.test(first)) label = first
    }
  }

  if (!label) return null

  const childLines = lines.slice(1).map((l) => l.replace(/^[-*]\s+/, '').replace(/^\[\s?\]\s*/, ''))
  const children: RawSegment[] = childLines.map((seg) => {
    const tags = extractTags(seg)
    if (tags.length === 0) tags.push(...extractKeywords(seg))
    return { text: seg, tags }
  })
  return { label: label.slice(0, 80), children }
}

/** Split dump into raw segments without classifying types. */
export function splitDump(raw: string): RawSegment[] {
  const text = raw.trim()
  if (!text) return []
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\[\s?\]\s*/, ''))
  return lines.map((seg) => {
    const tags = extractTags(seg)
    if (tags.length === 0) tags.push(...extractKeywords(seg))
    return { text: seg, tags }
  })
}
