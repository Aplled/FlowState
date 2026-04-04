import { useNodeStore } from '@/stores/node-store'
import { nanoid } from 'nanoid'
import { Plus, Trash2 } from 'lucide-react'
import type { FlowNode, TableData, TableColumn, Json } from '@/types/database'

export function TableNodeExpanded({ node }: { node: FlowNode }) {
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

  const renameColumn = (colId: string, name: string) => {
    patchData({ columns: data.columns.map((c) => c.id === colId ? { ...c, name } : c) })
  }

  const deleteColumn = (colId: string) => {
    patchData({
      columns: data.columns.filter((c) => c.id !== colId),
      rows: data.rows.map((r) => { const { [colId]: _, ...rest } = r; return rest }),
    })
  }

  const deleteRow = (idx: number) => {
    patchData({ rows: data.rows.filter((_, i) => i !== idx) })
  }

  return (
    <div className="p-6 space-y-4">
      <input
        value={data.title}
        onChange={(e) => patchData({ title: e.target.value })}
        className="w-full text-xl font-bold bg-transparent text-text outline-none"
        placeholder="Table title"
      />

      <div className="overflow-auto">
        {data.columns.length === 0 ? (
          <button onClick={addColumn} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text cursor-pointer">
            <Plus className="h-4 w-4" /> Add column
          </button>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {data.columns.map((col) => (
                  <th key={col.id} className="border border-border px-3 py-2 text-left text-text-secondary font-medium">
                    <div className="flex items-center gap-1">
                      <input
                        value={col.name}
                        onChange={(e) => renameColumn(col.id, e.target.value)}
                        className="bg-transparent outline-none flex-1 cursor-text"
                      />
                      <button onClick={() => deleteColumn(col.id)} className="text-text-muted hover:text-danger cursor-pointer p-0.5 opacity-0 hover:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border border-border w-10">
                  <button onClick={addColumn} className="text-text-muted hover:text-text cursor-pointer p-1">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="group">
                  {data.columns.map((col) => (
                    <td key={col.id} className="border border-border px-2">
                      <input
                        value={(row[col.id] as string) ?? ''}
                        onChange={(e) => updateCell(i, col.id, e.target.value)}
                        className="w-full bg-transparent py-1.5 text-text outline-none cursor-text"
                      />
                    </td>
                  ))}
                  <td className="border border-border text-center">
                    <button onClick={() => deleteRow(i)} className="text-text-muted hover:text-danger cursor-pointer p-0.5 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.columns.length > 0 && (
          <button onClick={addRow} className="flex items-center gap-1.5 mt-2 text-sm text-text-muted hover:text-text cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Add row
          </button>
        )}
      </div>
    </div>
  )
}
