import { useNodeStore } from '@/stores/node-store'
import { getGoogleAccessToken } from '@/lib/google-auth'
import {
  fetchGoogleEvents,
  googleEventToEventData,
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
  type GoogleEvent,
} from './calendar-sync'
import type { EventData, FlowNode, Json } from '@/types/database'

// Persistent sync state
let syncTimers: Record<string, ReturnType<typeof setInterval>> = {}
let lastSyncTimestamps: Record<string, string> = {}

export interface SyncResult {
  created: number
  updated: number
  pushed: number
  errors: string[]
}

/**
 * Main sync: bidirectional between Google Calendar and local Event nodes.
 */
export async function syncCalendar(
  workspaceId: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string,
): Promise<SyncResult> {
  const token = await getGoogleAccessToken()
  if (!token) throw new Error('Not signed in to Google')

  const now = new Date()
  const min = timeMin ?? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const max = timeMax ?? new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

  const result: SyncResult = { created: 0, updated: 0, pushed: 0, errors: [] }

  // Fetch remote events
  let remoteEvents: GoogleEvent[]
  try {
    remoteEvents = await fetchGoogleEvents(token, calendarId, min, max)
  } catch (err) {
    throw new Error(`Failed to fetch Google events: ${(err as Error).message}`)
  }

  // Get local event nodes in this workspace
  const store = useNodeStore.getState()
  const localEventNodes = store.nodes.filter(
    (n) => n.workspace_id === workspaceId && n.type === 'event',
  )

  // Build lookup maps
  const localByGoogleId = new Map<string, FlowNode>()
  const localWithoutGoogle: FlowNode[] = []
  for (const node of localEventNodes) {
    const data = node.data as unknown as EventData
    if (data.google_event_id && data.google_calendar_id === calendarId) {
      localByGoogleId.set(data.google_event_id, node)
    } else if (!data.google_event_id) {
      localWithoutGoogle.push(node)
    }
  }

  const remoteById = new Map<string, GoogleEvent>()
  for (const ge of remoteEvents) {
    remoteById.set(ge.id, ge)
  }

  // 1. Remote events not in local -> create local nodes
  for (const ge of remoteEvents) {
    if (!localByGoogleId.has(ge.id)) {
      try {
        const eventData = googleEventToEventData(ge, calendarId)
        await store.addNode(workspaceId, 'event', { x: 100 + result.created * 30, y: 100 + result.created * 30 }, eventData as unknown as Json)
        result.created++
      } catch (err) {
        result.errors.push(`Create local for "${ge.summary}": ${(err as Error).message}`)
      }
    }
  }

  // 2. Remote events that exist locally -> check for updates (last-write-wins)
  for (const [googleId, localNode] of localByGoogleId) {
    const remote = remoteById.get(googleId)
    if (!remote) {
      // Remote deleted -> remove locally
      store.deleteNode(localNode.id)
      continue
    }

    const localData = localNode.data as unknown as EventData
    const remoteUpdated = new Date(remote.updated).getTime()
    const localUpdated = new Date(localNode.updated_at).getTime()

    if (remoteUpdated > localUpdated) {
      // Remote is newer -> update local
      const updated = googleEventToEventData(remote, calendarId)
      store.updateNode(localNode.id, { data: updated as unknown as Json })
      result.updated++
    } else if (localUpdated > remoteUpdated) {
      // Local is newer -> push to Google
      try {
        await updateGoogleEvent(token, calendarId, googleId, localData)
        store.updateNode(localNode.id, {
          data: { ...localData, last_synced_at: new Date().toISOString() } as unknown as Json,
        })
        result.pushed++
      } catch (err) {
        result.errors.push(`Push update "${localData.title}": ${(err as Error).message}`)
      }
    }
  }

  // 3. Local events without google_event_id -> push to Google
  for (const node of localWithoutGoogle) {
    const data = node.data as unknown as EventData
    try {
      const created = await pushEventToGoogle(token, calendarId, data)
      store.updateNode(node.id, {
        data: {
          ...data,
          google_event_id: created.id,
          google_calendar_id: calendarId,
          last_synced_at: new Date().toISOString(),
        } as unknown as Json,
      })
      result.pushed++
    } catch (err) {
      result.errors.push(`Push new "${data.title}": ${(err as Error).message}`)
    }
  }

  lastSyncTimestamps[workspaceId] = new Date().toISOString()
  return result
}

/**
 * Start periodic sync for a workspace.
 */
export function startPeriodicSync(
  workspaceId: string,
  calendarId: string,
  intervalMs: number = 5 * 60 * 1000,
) {
  stopPeriodicSync(workspaceId)
  // Run immediately then on interval
  syncCalendar(workspaceId, calendarId).catch(console.error)
  syncTimers[workspaceId] = setInterval(() => {
    syncCalendar(workspaceId, calendarId).catch(console.error)
  }, intervalMs)
}

/**
 * Stop periodic sync for a workspace.
 */
export function stopPeriodicSync(workspaceId: string) {
  if (syncTimers[workspaceId]) {
    clearInterval(syncTimers[workspaceId])
    delete syncTimers[workspaceId]
  }
}

/**
 * Get the last sync timestamp for a workspace.
 */
export function getLastSyncTime(workspaceId: string): string | null {
  return lastSyncTimestamps[workspaceId] ?? null
}
