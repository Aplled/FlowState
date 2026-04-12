/**
 * Tiny multinomial logistic regression head trained on accept/reject
 * feedback. Activates once we have ≥ MIN_SAMPLES labeled examples.
 *
 * Inputs: 384-dim L2-normalized embeddings.
 * Output: probability distribution over workspace ids.
 *
 * Trained client-side via mini-batch SGD with cross-entropy loss.
 * Persisted to localStorage.
 */

import { EMBEDDING_DIM } from '@/services/embeddings'

const LS_KEY = 'flowstate-asb-classifier'
export const MIN_SAMPLES_TO_ACTIVATE = 30

export interface TrainingSample {
  embedding: number[] // stored as plain array for JSON
  workspace_id: string
}

interface SerializedModel {
  classes: string[]
  weights: number[][] // [num_classes][EMBEDDING_DIM]
  bias: number[]
  sampleCount: number
}

export class OnlineClassifier {
  classes: string[] = []
  weights: Float32Array[] = [] // one row per class
  bias: Float32Array = new Float32Array(0)
  sampleCount = 0

  static load(): OnlineClassifier {
    const c = new OnlineClassifier()
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return c
      const data: SerializedModel = JSON.parse(raw)
      c.classes = data.classes
      c.weights = data.weights.map((w) => new Float32Array(w))
      c.bias = new Float32Array(data.bias)
      c.sampleCount = data.sampleCount
    } catch { /* ignore */ }
    return c
  }

  save(): void {
    const data: SerializedModel = {
      classes: this.classes,
      weights: this.weights.map((w) => Array.from(w)),
      bias: Array.from(this.bias),
      sampleCount: this.sampleCount,
    }
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignore */ }
  }

  isReady(): boolean {
    return this.sampleCount >= MIN_SAMPLES_TO_ACTIVATE && this.classes.length >= 2
  }

  private ensureClass(wsId: string): number {
    let idx = this.classes.indexOf(wsId)
    if (idx >= 0) return idx
    idx = this.classes.length
    this.classes.push(wsId)
    this.weights.push(new Float32Array(EMBEDDING_DIM))
    const newBias = new Float32Array(this.classes.length)
    newBias.set(this.bias)
    this.bias = newBias
    return idx
  }

  /** Forward pass — returns softmax probabilities over classes. */
  predict(emb: Float32Array): { workspace_id: string; prob: number }[] {
    if (this.classes.length === 0) return []
    const logits = new Float32Array(this.classes.length)
    for (let c = 0; c < this.classes.length; c++) {
      let z = this.bias[c]
      const w = this.weights[c]
      for (let i = 0; i < EMBEDDING_DIM; i++) z += w[i] * emb[i]
      logits[c] = z
    }
    // Softmax
    let maxL = -Infinity
    for (const l of logits) if (l > maxL) maxL = l
    let sum = 0
    const probs = new Float32Array(logits.length)
    for (let i = 0; i < logits.length; i++) {
      probs[i] = Math.exp(logits[i] - maxL)
      sum += probs[i]
    }
    for (let i = 0; i < probs.length; i++) probs[i] /= sum
    return this.classes.map((wsId, i) => ({ workspace_id: wsId, prob: probs[i] }))
      .sort((a, b) => b.prob - a.prob)
  }

  /**
   * Train on a single (embedding, workspace_id) example using one
   * SGD step with cross-entropy loss. Cheap and online.
   */
  trainOne(emb: Float32Array, wsId: string, lr = 0.1): void {
    this.ensureClass(wsId)
    const targetIdx = this.classes.indexOf(wsId)
    const probs = this.predict(emb)
    // probs is sorted by prob desc; rebuild aligned to this.classes order
    const probMap = new Map(probs.map((p) => [p.workspace_id, p.prob]))

    for (let c = 0; c < this.classes.length; c++) {
      const y = c === targetIdx ? 1 : 0
      const p = probMap.get(this.classes[c]) ?? 0
      const grad = p - y // derivative of softmax+CE wrt logit
      const w = this.weights[c]
      for (let i = 0; i < EMBEDDING_DIM; i++) w[i] -= lr * grad * emb[i]
      this.bias[c] -= lr * grad
    }
    this.sampleCount += 1
  }

  /** Batch train — useful when bootstrapping from existing nodes. */
  trainBatch(samples: { emb: Float32Array; wsId: string }[], epochs = 5, lr = 0.1): void {
    for (let e = 0; e < epochs; e++) {
      // Shuffle
      const order = samples.map((_, i) => i)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      for (const i of order) {
        // Use trainOne but don't double-count samples after first epoch
        const before = this.sampleCount
        this.trainOne(samples[i].emb, samples[i].wsId, lr)
        if (e > 0) this.sampleCount = before
      }
    }
  }

  reset(): void {
    this.classes = []
    this.weights = []
    this.bias = new Float32Array(0)
    this.sampleCount = 0
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
  }
}
