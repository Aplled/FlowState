import type { FlowNode, Connection, TaskData, NoteData, DocData, TableData, EventData, DrawData } from '@/types/database'
import getStroke from 'perfect-freehand'

function getSvgPathFromStroke(stroke: number[][]) {
  if (stroke.length < 2) return ''
  const d = [`M ${stroke[0][0]} ${stroke[0][1]}`]
  for (let i = 1; i < stroke.length; i++) {
    d.push(`L ${stroke[i][0]} ${stroke[i][1]}`)
  }
  d.push('Z')
  return d.join(' ')
}

export function exportNodeAsMarkdown(node: FlowNode): string {
  switch (node.type) {
    case 'task': {
      const d = node.data as unknown as TaskData
      const check = d.status === 'done' ? '[x]' : '[ ]'
      let md = `- ${check} **${d.title}**\n`
      if (d.priority !== 'none') md += `  - Priority: ${d.priority}\n`
      if (d.status) md += `  - Status: ${d.status}\n`
      if (d.due_date) md += `  - Due: ${d.due_date}\n`
      if (d.tags.length) md += `  - Tags: ${d.tags.join(', ')}\n`
      if (d.description) md += `  - ${d.description}\n`
      return md
    }
    case 'note': {
      const d = node.data as unknown as NoteData
      let md = ''
      if (d.title) md += `## ${d.title}\n\n`
      md += d.content + '\n'
      return md
    }
    case 'doc': {
      const d = node.data as unknown as DocData
      return `# ${d.title}\n\n${d.content}\n`
    }
    case 'table': {
      const d = node.data as unknown as TableData
      if (!d.columns.length) return `## ${d.title}\n\n(empty table)\n`
      const header = '| ' + d.columns.map((c) => c.name).join(' | ') + ' |'
      const sep = '| ' + d.columns.map(() => '---').join(' | ') + ' |'
      const rows = d.rows.map((row) =>
        '| ' + d.columns.map((c) => String(row[c.id] ?? '')).join(' | ') + ' |'
      )
      return `## ${d.title}\n\n${header}\n${sep}\n${rows.join('\n')}\n`
    }
    case 'event': {
      const d = node.data as unknown as EventData
      let md = `## ${d.title}\n\n`
      md += `- Start: ${d.start_time}\n`
      md += `- End: ${d.end_time}\n`
      if (d.all_day) md += `- All day\n`
      if (d.location) md += `- Location: ${d.location}\n`
      if (d.description) md += `\n${d.description}\n`
      return md
    }
    case 'draw':
      return '[Drawing]\n'
    default:
      return `[${node.type} node]\n`
  }
}

export function exportNodeAsImage(node: FlowNode): Promise<Blob> {
  const data = node.data as unknown as DrawData
  const strokes = data.strokes || []

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      if (pt[0] < minX) minX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] > maxY) maxY = pt[1]
    }
  }

  const padding = 20
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300 }
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = data.background || '#1a1a25'
  ctx.fillRect(0, 0, width, height)

  for (const stroke of strokes) {
    if (stroke.color.startsWith('text:')) {
      const parts = stroke.color.split(':')
      const textColor = parts[1]
      const text = parts.slice(2).join(':')
      ctx.fillStyle = textColor
      ctx.font = `${stroke.size * 3}px Inter, sans-serif`
      ctx.fillText(text, stroke.points[0][0] - minX + padding, stroke.points[0][1] - minY + padding)
    } else {
      const outline = getStroke(stroke.points.map((p) => [p[0] - minX + padding, p[1] - minY + padding]), {
        size: stroke.size,
        smoothing: 0.5,
        thinning: 0.5,
      })
      if (outline.length < 2) continue
      ctx.fillStyle = stroke.color
      ctx.beginPath()
      ctx.moveTo(outline[0][0], outline[0][1])
      for (let i = 1; i < outline.length; i++) {
        ctx.lineTo(outline[i][0], outline[i][1])
      }
      ctx.closePath()
      ctx.fill()
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}

export function exportWorkspaceAsMarkdown(nodes: FlowNode[], connections: Connection[]): string {
  let md = '# Workspace Export\n\n'

  for (const node of nodes) {
    md += exportNodeAsMarkdown(node) + '\n'
  }

  if (connections.length) {
    md += '## Connections\n\n'
    for (const conn of connections) {
      const arrow = conn.direction === 'bidirectional' ? '<->' : conn.direction === 'directed' ? '->' : '--'
      md += `- ${conn.source_node_id} ${arrow} ${conn.target_node_id}`
      if (conn.label) md += ` (${conn.label})`
      md += '\n'
    }
  }

  return md
}

export function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
