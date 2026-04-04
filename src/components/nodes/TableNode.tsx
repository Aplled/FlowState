import { memo, useState } from 'react'
import { Table, Plus } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { nanoid } from 'nanoid'
import type { FlowNode, TableData, TableColumn, Json } from '@/types/database'

interface TableNodeProps {
  node: FlowNode
  selected: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const TableNode = memo(function TableNode({ node, selected, onDragStart, onSelect }: TableNodeProps) {
  const data = node.data as unknown as TableData
  const updateNode = useNodeStore((s) => s.updateNode)

  const patchData = (patch: Partial<TableData>) => {
    updateNode(node.id, { data: { ...data, ...patch } as unknown as FlowNode['data'] })
  }

  const addColumn = () => {
    const col: TableColumn = { id: nanoid(6), name: `Col ${data.columns.length + 1}`, type: 'text' }
    patchData({ columns: [...data.columns, col] })
  }

  const addRow = () => {
    const row: Record<string, Json> = {}
    data.columns.forEach((c) => { row[c.id] = '' })
    patchData({ rows: [...data.rows, row] })
  }

  const updateCell = (rowIdx: number, colId: string, value: string) => {
    const rows = [...data.rows]
    rows[rowIdx] = { ...rows[rowIdx], [colId]: value }
    patchData({ rows })
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      color="#14b8a6"
      icon={<Table className="h-3.5 w-3.5" />}
      title={data.title}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2 text-xs overflow-auto max-h-[250px]">
        {data.columns.length === 0 ? (
          <button onClick={addColumn} className="flex items-center gap-1 text-text-muted hover:text-text cursor-pointer">
            <Plus className="h-3 w-3" /> Add column
          </button>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {data.columns.map((col) => (
                  <th key={col.id} className="border border-border px-2 py-1 text-left text-text-secondary font-medium">
                    {col.name}
                  </th>
                ))}
                <th className="border border-border w-8">
                  <button onClick={addColumn} className="text-text-muted hover:text-text cursor-pointer p-0.5">
                    <Plus className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  {data.columns.map((col) => (
                    <td key={col.id} className="border border-border px-1">
                      <input
                        value={(row[col.id] as string) ?? ''}
                        onChange={(e) => updateCell(i, col.id, e.target.value)}
                        className="w-full bg-transparent py-0.5 text-text outline-none cursor-text"
                      />
                    </td>
                  ))}
                  <td className="border border-border" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.columns.length > 0 && (
          <button onClick={addRow} className="flex items-center gap-1 text-text-muted hover:text-text cursor-pointer">
            <Plus className="h-3 w-3" /> Add row
          </button>
        )}
      </div>
    </BaseNode>
  )
})
