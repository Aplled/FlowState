import type { NodeType, Json } from '@/types/database'

export interface ParsedSegment {
  type: NodeType
  data: Json
  tags: string[]
}

const TASK_PREFIXES = /^(\s*[-*]\s*\[\s?\]\s*|todo[:\s]+|task[:\s]+|\[\s?\]\s*)/i
const TASK_VERBS = /^(do|make|finish|complete|build|write|send|email|call|fix|update|create|review|read|buy|get|schedule|book|prepare|draft|ship|deploy|test|check|ask|tell|remind|setup|set up|plan|organize|clean|refactor|implement|add)\b/i
const TASK_PHRASES = /\b(need to|have to|should|must|remember to|don'?t forget|gotta)\b/i
const URL_RE = /^https?:\/\/\S+/i
const HASHTAG_RE = /#([a-z0-9_-]+)/gi
const TIME_RE = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/i
const DATE_WORDS = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i
const DATE_NUMERIC = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/
const EVENT_PHRASES = /\b(meeting|call with|appointment|lunch with|dinner with|interview|standup|sync|1:1|demo|flight|class|deadline|due)\b/i

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','have','has','had','was','were','will','would','could','should','about','into','your','their','they','them','our','you','are','but','not','all','any','can','out','one','two','its','it\'s','also','than','then','just','some','more','very','too','here','there','what','when','where','who','how','why','because','been','being','over','under','off','onto','upon','per','via','let','make','need','want','get','got','use'
])

function detectType(text: string): NodeType {
  const trimmed = text.trim()
  if (URL_RE.test(trimmed)) return 'browser'
  if (TASK_PREFIXES.test(trimmed)) return 'task'

  // Event signals: time + date words, or explicit event phrases with a time
  const hasTime = TIME_RE.test(trimmed)
  const hasDate = DATE_WORDS.test(trimmed) || DATE_NUMERIC.test(trimmed)
  const hasEventPhrase = EVENT_PHRASES.test(trimmed)
  if ((hasTime && (hasDate || hasEventPhrase)) || (hasDate && hasEventPhrase)) {
    return 'event'
  }

  // Task signals
  const stripped = trimmed.replace(TASK_PREFIXES, '')
  if (TASK_PHRASES.test(trimmed) || TASK_VERBS.test(stripped)) return 'task'

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

/** Parse a date/time hint into an ISO start time, falling back to "in 1 hour". */
function guessStartTime(text: string): string {
  const now = new Date()
  const lower = text.toLowerCase()
  const target = new Date(now)

  // Day-of-week
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const dayIdx = days.findIndex((d) => lower.includes(d))
  if (dayIdx >= 0) {
    const diff = (dayIdx - now.getDay() + 7) % 7 || 7
    target.setDate(now.getDate() + diff)
  } else if (lower.includes('tomorrow')) {
    target.setDate(now.getDate() + 1)
  } else if (lower.includes('tonight')) {
    target.setHours(19, 0, 0, 0)
    return target.toISOString()
  }

  // Time
  const tm = lower.match(/(\d{1,2})(?::(\d{2}))?\s?(am|pm)?/)
  if (tm) {
    let h = parseInt(tm[1], 10)
    const min = tm[2] ? parseInt(tm[2], 10) : 0
    const mer = tm[3]
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) target.setHours(h, min, 0, 0)
  } else {
    target.setHours(9, 0, 0, 0)
  }

  return target.toISOString()
}

function buildData(type: NodeType, text: string, tags: string[]): Json {
  const trimmed = text.trim()
  const titleLine = trimmed.split('\n')[0].slice(0, 120)

  switch (type) {
    case 'task':
      return {
        title: trimmed.replace(TASK_PREFIXES, '').split('\n')[0].slice(0, 200),
        status: 'todo',
        priority: 'none',
        tags,
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
    default:
      return { content: trimmed, tags }
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

  // Normalize and split on blank lines first.
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)

  const segments: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    let buffer: string[] = []

    const flush = () => {
      if (buffer.length) {
        segments.push(buffer.join('\n').trim())
        buffer = []
      }
    }

    for (const line of lines) {
      const t = line.trim()
      if (!t) {
        flush()
        continue
      }
      const isBullet = /^[-*]\s+/.test(t) || /^\[\s?\]\s*/.test(t) || /^todo[:\s]/i.test(t)
      const isUrl = URL_RE.test(t)
      if (isBullet || isUrl) {
        flush()
        segments.push(t.replace(/^[-*]\s+/, ''))
      } else {
        buffer.push(t)
      }
    }
    flush()
  }

  // If everything ended up as a single segment, keep it as one node.
  return segments.map((seg) => {
    const type = detectType(seg)
    const tags = extractTags(seg)
    if (tags.length === 0) tags.push(...extractKeywords(seg))
    return { type, data: buildData(type, seg, tags), tags }
  })
}
