import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Table } from 'lucide-react'
import type { TableData } from '@/types/database'

export const TableNode = memo(function TableNode(props: NodeProps) {
  const data = props.data as unknown as TableData & { _dbNode: unknown }

  return (
    <BaseNode
      nodeProps={props}
      color="var(--color-node-table)"
      icon={<Table className="h-3.5 w-3.5" />}
      title={data.title ?? 'Table'}
    >
      <div className="overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-secondary">
              {(data.columns ?? []).length > 0 ? (
                data.columns.map((col) => (
                  <th key={col.id} className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-text-secondary">
                    {col.name}
                  </th>
                ))
              ) : (
                <>
                  <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-text-secondary">Column 1</th>
                  <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-text-secondary">Column 2</th>
                  <th className="border-b border-border px-2 py-1.5 text-left font-medium text-text-secondary">Column 3</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {(data.rows ?? []).length > 0 ? (
              data.rows.map((row, i) => (
                <tr key={i}>
                  {data.columns.map((col) => (
                    <td key={col.id} className="border-b border-r border-border px-2 py-1.5 text-text-secondary">
                      {String(row[col.id] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(data.columns?.length ?? 3, 3)} className="px-2 py-4 text-center text-text-muted">
                  Empty table — click to add data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BaseNode>
  )
})
