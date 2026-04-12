import { memo, useRef, useState } from 'react'
import { Table, Plus, Upload } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { useNodeStore } from '@/stores/node-store'
import { useLayoutStore } from '@/stores/layout-store'
import { nanoid } from 'nanoid'
import type { FlowNode, TableData, TableColumn, Json } from '@/types/database'

interface TableNodeProps {
  node: FlowNode
  selected: boolean
  connectTarget?: boolean
  onDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void
  onSelect: (e: React.MouseEvent, id: string) => void
}

export const TableNode = memo(function TableNode({ node, selected, connectTarget, onDragStart, onSelect }: TableNodeProps) {
  const data = node.data as unknown as TableData
  const updateNode = useNodeStore((s) => s.updateNode)
  const compact = useLayoutStore((s) => s.compactNodeHeaders)
  const [title, setTitle] = useState(data.title)
  const csvInputRef = useRef<HTMLInputElement>(null)

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

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) return
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length === 0) return
      const parseRow = (line: string) => {
        const cells: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
            else if (ch === '"') inQuotes = false
            else current += ch
          } else {
            if (ch === '"') inQuotes = true
            else if (ch === ',') { cells.push(current.trim()); current = '' }
            else current += ch
          }
        }
        cells.push(current.trim())
        return cells
      }
      const headers = parseRow(lines[0])
      const columns: TableColumn[] = headers.map((h) => ({ id: nanoid(6), name: h || 'Untitled', type: 'text' as const }))
      const rows = lines.slice(1).map((line) => {
        const cells = parseRow(line)
        const row: Record<string, Json> = {}
        columns.forEach((col, i) => { row[col.id] = cells[i] ?? '' })
        return row
      })
      patchData({ columns, rows })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const csvHeaderButton = (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); csvInputRef.current?.click() }}
        className="rounded-lg p-1 text-text-muted hover:bg-bg-hover hover:text-text cursor-pointer transition-colors"
        title="Import CSV"
      >
        <Upload className="h-3 w-3" />
      </button>
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
    </>
  )

  return (
    <BaseNode
      node={node}
      selected={selected}
      connectTarget={connectTarget}
      color="#5a7c5a"
      icon={<Table className="h-3.5 w-3.5" />}
      title={title || 'Table'}
      titleInput={
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            patchData({ title: e.target.value })
          }}
          placeholder="Table title..."
          className="w-full bg-transparent text-xs font-medium text-text placeholder:text-text-muted outline-none cursor-text"
        />
      }
      headerExtra={csvHeaderButton}
      onDragStart={onDragStart}
      onSelect={onSelect}
    >
      <div className="space-y-2 text-xs overflow-auto max-h-[250px]">
        {data.columns.length === 0 ? (
          <button onClick={addColumn} className="flex items-center gap-1.5 text-text-muted hover:text-text cursor-pointer transition-colors">
            <Plus className="h-3 w-3" /> Add column
          </button>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {data.columns.map((col) => (
                  <th key={col.id} className="border border-border/60 rounded px-2 py-1.5 text-left text-text-secondary font-medium">
                    {col.name}
                  </th>
                ))}
                <th className="border border-border/60 w-8">
                  <button onClick={addColumn} className="text-text-muted hover:text-text cursor-pointer p-0.5 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  {data.columns.map((col) => (
                    <td key={col.id} className="border border-border/60 px-1">
                      <input
                        value={(row[col.id] as string) ?? ''}
                        onChange={(e) => updateCell(i, col.id, e.target.value)}
                        className="w-full bg-transparent py-1 text-text outline-none cursor-text"
                      />
                    </td>
                  ))}
                  <td className="border border-border/60" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.columns.length > 0 && (
          <button onClick={addRow} className="flex items-center gap-1.5 text-text-muted hover:text-text cursor-pointer transition-colors">
            <Plus className="h-3 w-3" /> Add row
          </button>
        )}
      </div>
    </BaseNode>
  )
})
