import { useNodeStore } from '@/stores/node-store'
import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { getGoogleAccessToken } from '@/lib/google-auth'
import {
  fetchGoogleEvents,
  pushEventToGoogle,
  updateGoogleEvent,
  googleEventToEventData,
  type GoogleEvent,
} from './calendar-sync'
import type { EventData, FlowNode, Json } from '@/types/database'

// Persistent sync state
let syncTimer: ReturnType<typeof setInterval> | null = null

export interface SyncResult {
  pulled: number
  pushed: number
  errors: string[]
}

/**
 * Pull events from Google for the selected calendar into the in-memory store.
 * Also reconciles any local Event nodes linked to Google (last-write-wins) and
 * pushes any unlinked local Event nodes that have a google_calendar_id set.
 */
export async function syncFromGoogle(
  timeMin?: string,
  timeMax?: string,
): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, errors: [] }

  const calendarId = useCalendarSyncStore.getState().selectedCalendarId
  if (!calendarId) {
    return result
  }

  const token = await getGoogleAccessToken()
  if (!token) throw new Error('Not signed in to Google')

  const now = new Date()
  const min = timeMin ?? new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
  const max = timeMax ?? new Date(now.getFullYear(), now.getMonth() + 6, 0).toISOString()

  // 1) Fetch remote events
  let remoteEvents: GoogleEvent[]
  try {
    remoteEvents = await fetchGoogleEvents(token, calendarId, min, max)
  } catch (err) {
    throw new Error(`Failed to fetch Google events: ${(err as Error).message}`)
  }

  useCalendarSyncStore.getState().setGoogleEvents(remoteEvents)
  result.pulled = remoteEvents.length

  // 2) Reconcile linked event nodes (across all workspaces)
  const remoteById = new Map<string, GoogleEvent>()
  for (const ge of remoteEvents) remoteById.set(ge.id, ge)

  const nodeStore = useNodeStore.getState()
  const linkedNodes = nodeStore.allNodes.filter((n) => {
    if (n.type !== 'event') return false
    const data = n.data as unknown as EventData
    return data.google_event_id != null && data.google_calendar_id === calendarId
  })

  for (const node of linkedNodes) {
    const data = node.data as unknown as EventData
    const remote = remoteById.get(data.google_event_id!)
    if (!remote) {
      // Remote deleted -> remove the linked node (don't echo a DELETE back to Google)
      nodeStore.deleteNode(node.id, { skipRemoteSync: true })
      continue
    }
    const remoteUpdated = new Date(remote.updated).getTime()
    const localUpdated = new Date(node.updated_at).getTime()
    if (remoteUpdated > localUpdated) {
      const updated = googleEventToEventData(remote, calendarId)
      nodeStore.updateNode(node.id, { data: updated as unknown as Json })
    } else if (localUpdated > remoteUpdated) {
      try {
        await updateGoogleEvent(token, calendarId, data.google_event_id!, data)
        nodeStore.updateNode(node.id, {
          data: { ...data, last_synced_at: new Date().toISOString() } as unknown as Json,
        })
        result.pushed++
      } catch (err) {
        result.errors.push(`Push update "${data.title}": ${(err as Error).message}`)
      }
    }
  }

  // 3) Push any local event nodes that target this calendar but have no google_event_id
  const unlinkedNodes: FlowNode[] = nodeStore.allNodes.filter((n) => {
    if (n.type !== 'event') return false
    const data = n.data as unknown as EventData
    return !data.google_event_id && data.google_calendar_id === calendarId
  })
  for (const node of unlinkedNodes) {
    const data = node.data as unknown as EventData
    try {
      const created = await pushEventToGoogle(token, calendarId, data)
      nodeStore.updateNode(node.id, {
        data: {
          ...data,
          google_event_id: created.id,
          last_synced_at: new Date().toISOString(),
        } as unknown as Json,
      })
      useCalendarSyncStore.getState().upsertGoogleEvent(created)
      result.pushed++
    } catch (err) {
      result.errors.push(`Push new "${data.title}": ${(err as Error).message}`)
    }
  }

  useCalendarSyncStore.getState().setLastSyncAt(new Date().toISOString())
  return result
}

/**
 * Start periodic background sync. Replaces any existing timer.
 */
export function startPeriodicSync(intervalMs: number = 5 * 60 * 1000) {
  stopPeriodicSync()
  if (intervalMs <= 0) return
  syncTimer = setInterval(() => {
    syncFromGoogle().catch((err) => console.error('Periodic sync failed:', err))
  }, intervalMs)
}

export function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
