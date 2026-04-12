/**
 * Embedding-based node type classifier.
 *
 * For each NodeType we maintain a small set of prototype sentences. We
 * embed them once (cached for the session), build a centroid per type,
 * then classify a new piece of text by cosine similarity to each centroid.
 *
 * This catches semantic meaning the keyword regex misses — e.g.
 *   "extra schoolwork due in 3 days" → task
 *   "thinking about how the inbox feels" → note
 *   "lunch with sarah" → event
 *
 * Falls back to the regex-based detectType() when the model isn't loaded
 * or when no prototype is confident enough.
 */

import type { NodeType } from '@/types/database'
import { embedText, cosine, meanVector, type Embedding } from '@/services/embeddings'
import { detectType } from '@/lib/dump-parser'

const PROTOTYPES: Record<NodeType, string[]> = {
  task: [
    'finish the quarterly report',
    'buy groceries on the way home',
    'submit the assignment by friday',
    'extra schoolwork due in three days',
    'pay the electric bill before next week',
    'study for the chemistry exam',
    'pick up dry cleaning tomorrow',
    'review pull request and leave comments',
    'send invoice to the client',
    'renew my drivers license this month',
    'fix the bug in the auth flow',
    'schedule a dentist appointment',
    'water the plants',
    'turn in the permission slip',
    'remember to call grandma',
  ],
  event: [
    'meeting with the design team at 3pm',
    'lunch with sarah tomorrow at noon',
    'flight to new york next tuesday',
    'standup at 9am every weekday',
    'interview with acme corp on friday',
    'dentist appointment next monday at 2',
    'birthday dinner saturday evening',
    'all-hands meeting thursday morning',
    'concert at the park on saturday',
    'doctor visit next week',
  ],
  note: [
    'random thought about how user interfaces feel cleaner with more whitespace',
    'interesting observation that most bugs come from state management not logic',
    'idea for a new feature where users can dump notes into an inbox',
    'reminder that the api always returns json wrapped in a data field',
    'realized that morning is when i think most clearly',
    'quote from a book i read last week',
    'fun fact about how octopuses have nine brains',
    'thinking about why some habits stick and others dont',
    'observation that meetings without agendas waste the most time',
    'something i learned today about distributed systems',
  ],
  doc: [
    'draft for the project proposal',
    'specification for the new authentication system',
    'meeting notes from the weekly sync',
    'design document for the data pipeline',
    'rfc on changing the api versioning scheme',
    'onboarding guide for new engineers',
    'technical writeup of the migration plan',
  ],
  browser: [
    'https://example.com/cool-article',
    'github repository link',
    'youtube video about machine learning',
    'stack overflow answer about typescript generics',
    'twitter thread on startup advice',
  ],
  table: [
    'comparison of database options',
    'spreadsheet of monthly expenses',
    'list of candidates with scores',
    'inventory of equipment',
  ],
  draw: [
    'sketch of the homepage layout',
    'whiteboard diagram of the architecture',
    'rough drawing of the logo',
  ],
  // These types should never be auto-suggested by the dump pad.
  tab: [],
  grouple: [],
}

const CONSIDERED_TYPES: NodeType[] = ['task', 'event', 'note', 'doc', 'browser']

interface TypeCentroid {
  type: NodeType
  centroid: Embedding
}

let centroidsPromise: Promise<TypeCentroid[]> | null = null

async function getCentroids(): Promise<TypeCentroid[]> {
  if (!centroidsPromise) {
    centroidsPromise = (async () => {
      const out: TypeCentroid[] = []
      for (const type of CONSIDERED_TYPES) {
        const prompts = PROTOTYPES[type]
        if (prompts.length === 0) continue
        const vecs: Embedding[] = []
        for (const p of prompts) {
          try {
            vecs.push(await embedText(p))
          } catch (err) {
            console.warn('prototype embed failed:', err)
          }
        }
        if (vecs.length > 0) out.push({ type, centroid: meanVector(vecs) })
      }
      return out
    })()
  }
  return centroidsPromise
}

/**
 * Classify text by cosine similarity to per-type centroids.
 * Combines with the regex-based heuristic as a tiebreaker / safety net.
 */
export async function classifyType(text: string): Promise<NodeType> {
  const heuristic = detectType(text)

  // Hard signals always win — URL → browser, bullet/checkbox → task.
  if (heuristic === 'browser') return 'browser'

  try {
    const centroids = await getCentroids()
    if (centroids.length === 0) return heuristic

    const emb = await embedText(text)
    if (emb.every((x) => x === 0)) return heuristic

    const scored = centroids.map((c) => ({ type: c.type, score: cosine(emb, c.centroid) }))
    scored.sort((a, b) => b.score - a.score)

    const top = scored[0]
    const runnerUp = scored[1]

    // Boost the heuristic pick a touch — it's catching strong syntactic
    // signals (verbs, "due", times) that the embedding model can miss.
    const heuristicBoost = 0.05
    const adjusted = scored.map((s) =>
      s.type === heuristic ? { ...s, score: s.score + heuristicBoost } : s,
    )
    adjusted.sort((a, b) => b.score - a.score)

    // If the top score is solid and meaningfully ahead of the runner-up,
    // trust the embedding. Otherwise defer to the heuristic.
    if (adjusted[0].score >= 0.35 && adjusted[0].score - (runnerUp?.score ?? 0) >= 0.02) {
      return adjusted[0].type
    }
    return heuristic
  } catch (err) {
    console.warn('classifyType failed:', err)
    return heuristic
  }
}
