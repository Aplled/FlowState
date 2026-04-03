import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { CalendarDays, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import type { EventData } from '@/types/database'

export const EventNode = memo(function EventNode(props: NodeProps) {
  const data = props.data as unknown as EventData & { _dbNode: unknown }

  const startDate = data.start_time ? new Date(data.start_time) : new Date()
  const endDate = data.end_time ? new Date(data.end_time) : new Date()

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-event)"
      icon={<CalendarDays className="h-3.5 w-3.5" />}
      title="Event"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-text">{data.title}</p>

        <div className="space-y-1 text-xs text-text-secondary">
          {data.all_day ? (
            <p>{format(startDate, 'MMM d, yyyy')} — All day</p>
          ) : (
            <p>
              {format(startDate, 'MMM d, h:mm a')} — {format(endDate, 'h:mm a')}
            </p>
          )}

          {data.location && (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {data.location}
            </p>
          )}
        </div>

        {data.google_event_id && (
          <span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-xs text-info">
            Synced
          </span>
        )}
      </div>
    </BaseNode>
  )
})
