import { useCalendarSyncStore } from '@/stores/calendar-sync-store'
import { useNodeStore } from '@/stores/node-store'
import {
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
} from './calendar-sync'
import type { EventData, FlowNode, Json } from '@/types/database'

const DEBOUNCE_MS = 800
const pending = new Map<string, ReturnType<typeof setTimeout>>()

function isValidEventData(data: EventData): boolean {
  return Boolean(data?.title && data.start_time && data.end_time)
}

/**
 * Schedule a debounced push of an event node to Google Calendar.
 * - Creates the remote event if not yet linked.
 * - Updates the remote event if already linked.
 * No-op when calendar is not connected or no calendar is selected.
 */
export function scheduleEventNodeSync(nodeId: string) {
  const existing = pending.get(nodeId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    pending.delete(nodeId)
    void runSync(nodeId)
  }, DEBOUNCE_MS)
  pending.set(nodeId, timer)
}

async function runSync(nodeId: string) {
  const calState = useCalendarSyncStore.getState()
  if (!calState.connected || !calState.selectedCalendarId) return

  const nodeStore = useNodeStore.getState()
  const node = nodeStore.allNodes.find((n) => n.id === nodeId)
  if (!node || node.type !== 'event') return

  const data = node.data as unknown as EventData
  if (!isValidEventData(data)) return

  // If event is already linked to a different calendar, skip auto-sync.
  if (data.google_calendar_id && data.google_calendar_id !== calState.selectedCalendarId) return

  try {
    const calendarId = calState.selectedCalendarId

    if (data.google_event_id) {
      const updated = await updateGoogleEvent(null, calendarId, data.google_event_id, data)
      calState.upsertGoogleEvent(updated)
      nodeStore.updateNode(nodeId, {
        data: {
          ...data,
          google_calendar_id: calendarId,
          last_synced_at: new Date().toISOString(),
        } as unknown as Json,
      })
    } else {
      const created = await pushEventToGoogle(null, calendarId, data)
      calState.upsertGoogleEvent(created)
      nodeStore.updateNode(nodeId, {
        data: {
          ...data,
          google_event_id: created.id,
          google_calendar_id: calendarId,
          last_synced_at: new Date().toISOString(),
        } as unknown as Json,
      })
    }
  } catch (err) {
    console.error('Auto-sync event failed:', err)
  }
}

/**
 * Delete the linked Google event for a node, if any. Fire-and-forget.
 */
export async function deleteLinkedGoogleEvent(node: FlowNode) {
  if (node.type !== 'event') return
  const data = node.data as unknown as EventData
  if (!data.google_event_id || !data.google_calendar_id) return

  // Cancel any pending push for this node
  const existing = pending.get(node.id)
  if (existing) {
    clearTimeout(existing)
    pending.delete(node.id)
  }

  try {
    await deleteGoogleEvent(null, data.google_calendar_id, data.google_event_id)
    useCalendarSyncStore.getState().removeGoogleEvent(data.google_event_id)
  } catch (err) {
    console.error('Failed to delete linked Google event:', err)
  }
}
