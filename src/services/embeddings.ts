/**
 * In-browser embedding service backed by all-MiniLM-L6-v2 (~22MB, cached
 * by the browser after first load). Embeddings are 384-dim float arrays.
 *
 * Embeddings are cached in IndexedDB keyed by `${nodeId}:${contentHash}`
 * so they only get recomputed when the underlying text actually changes.
 */

import type { FlowNode, Json } from '@/types/database'

const DB_NAME = 'flowstate-embeddings'
const STORE_NAME = 'vectors'
const DB_VERSION = 1
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
// Pin the HuggingFace revision so a future upload to the model repo (whether
// from a compromised HF account or an intentional breaking change) can't
// silently substitute model weights on users' next cold cache load. Bump
// this to a newer commit when you verify a release is safe.
// https://huggingface.co/Xenova/all-MiniLM-L6-v2/commits/main
const MODEL_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9'

export type Embedding = Float32Array
export const EMBEDDING_DIM = 384

// ---------- model loader ----------

type FeaturePipeline = (text: string, opts: { pooling: 'mean'; normalize: boolean }) =>
  Promise<{ data: Float32Array }>

let pipelinePromise: Promise<FeaturePipeline> | null = null

export function preloadEmbeddingModel(): Promise<FeaturePipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers')
      // Force the WASM backend; cache models in the browser.
      env.allowLocalModels = false
      env.useBrowserCache = true
      // Pin to a specific commit SHA so the runtime always pulls the same
      // weights. With revision: 'main' (the library default) any push to
      // the model repo takes effect on the next user who hits a cold cache.
      return (await pipeline('feature-extraction', MODEL_ID, {
        revision: MODEL_REVISION,
      })) as unknown as FeaturePipeline
    })()
  }
  return pipelinePromise
}

// ---------- IndexedDB cache ----------

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function dbGet(key: string): Promise<Float32Array | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => {
      const v = req.result
      if (!v) return resolve(null)
      resolve(v instanceof Float32Array ? v : new Float32Array(v))
    }
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(key: string, vec: Float32Array): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(vec, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- text extraction + hashing ----------

export function extractNodeText(node: FlowNode): string {
  const d = node.data as Record<string, Json> | null
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ''
  const parts: string[] = [node.type]
  for (const key of ['title', 'content', 'description', 'label', 'url', 'location'] as const) {
    const v = d[key]
    if (typeof v === 'string' && v.trim()) parts.push(v)
  }
  if (Array.isArray(d.tags)) {
    for (const t of d.tags) if (typeof t === 'string') parts.push('#' + t)
  }
  return parts.join(' ').slice(0, 1000)
}

/** Fast non-cryptographic hash (FNV-1a 32-bit) — good enough for cache keys. */
function hashText(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// ---------- public API ----------

const memCache = new Map<string, Float32Array>()

/** Embed an arbitrary text string (no caching). Use embedNode for nodes. */
export async function embedText(text: string): Promise<Float32Array> {
  if (!text.trim()) return new Float32Array(EMBEDDING_DIM)
  const pipe = await preloadEmbeddingModel()
  const out = await pipe(text, { pooling: 'mean', normalize: true })
  return new Float32Array(out.data)
}

/** Embed a node, using the IndexedDB cache. */
export async function embedNode(node: FlowNode): Promise<Float32Array> {
  const text = extractNodeText(node)
  if (!text.trim()) return new Float32Array(EMBEDDING_DIM)

  const key = `${node.id}:${hashText(text)}`
  if (memCache.has(key)) return memCache.get(key)!

  const cached = await dbGet(key)
  if (cached) {
    memCache.set(key, cached)
    return cached
  }

  const vec = await embedText(text)
  memCache.set(key, vec)
  await dbPut(key, vec).catch((e) => console.warn('embedding cache write failed:', e))

  // Best-effort: drop stale entries for this node id (old content hash).
  void cleanupOldVersions(node.id, key)

  return vec
}

/** Embed many nodes in parallel-ish (sequential to avoid clobbering the WASM thread). */
export async function embedNodes(nodes: FlowNode[]): Promise<Map<string, Float32Array>> {
  const out = new Map<string, Float32Array>()
  for (const n of nodes) {
    try {
      out.set(n.id, await embedNode(n))
    } catch (err) {
      console.warn('embedNode failed for', n.id, err)
    }
  }
  return out
}

async function cleanupOldVersions(nodeId: string, currentKey: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const req = store.openKeyCursor()
  req.onsuccess = () => {
    const cursor = req.result
    if (!cursor) return
    const k = String(cursor.key)
    if (k.startsWith(nodeId + ':') && k !== currentKey) {
      store.delete(cursor.key)
      memCache.delete(k)
    }
    cursor.continue()
  }
}

export async function deleteNodeEmbedding(nodeId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const req = store.openKeyCursor()
  req.onsuccess = () => {
    const cursor = req.result
    if (!cursor) return
    const k = String(cursor.key)
    if (k.startsWith(nodeId + ':')) {
      store.delete(cursor.key)
      memCache.delete(k)
    }
    cursor.continue()
  }
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
  void dbDelete(nodeId)
}

// ---------- vector math ----------

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let dot = 0
  // MiniLM outputs are L2-normalized, so dot == cosine.
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export function meanVector(vecs: Float32Array[]): Float32Array {
  if (vecs.length === 0) return new Float32Array(EMBEDDING_DIM)
  const out = new Float32Array(vecs[0].length)
  for (const v of vecs) for (let i = 0; i < v.length; i++) out[i] += v[i]
  for (let i = 0; i < out.length; i++) out[i] /= vecs.length
  // Re-normalize so cosine math stays correct.
  let norm = 0
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < out.length; i++) out[i] /= norm
  return out
}
