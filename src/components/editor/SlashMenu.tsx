import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { type Editor } from '@tiptap/react'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Table, Image, AlertCircle, ToggleLeft,
  FileText, Type, Columns,
} from 'lucide-react'

export interface SlashMenuItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (editor: Editor) => void
  aliases?: string[]
}

export const slashMenuItems: SlashMenuItem[] = [
  {
    title: 'Text',
    description: 'Plain text block',
    icon: <Type className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().setParagraph().run(),
    aliases: ['paragraph', 'p'],
  },
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: <Heading1 className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    aliases: ['h1', '#'],
  },
  {
    title: 'Heading 2',
    description: 'Medium heading',
    icon: <Heading2 className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    aliases: ['h2', '##'],
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: <Heading3 className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    aliases: ['h3', '###'],
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: <List className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
    aliases: ['ul', 'bullets'],
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    aliases: ['ol', 'numbered'],
  },
  {
    title: 'To-do List',
    description: 'Checklist with checkboxes',
    icon: <CheckSquare className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
    aliases: ['todo', 'checkbox', 'checklist'],
  },
  {
    title: 'Quote',
    description: 'Block quote',
    icon: <Quote className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    aliases: ['blockquote', '>'],
  },
  {
    title: 'Code Block',
    description: 'Code with syntax highlighting',
    icon: <Code className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    aliases: ['code', '```'],
  },
  {
    title: 'Divider',
    description: 'Horizontal line',
    icon: <Minus className="h-4 w-4" />,
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    aliases: ['hr', 'line', '---'],
  },
  {
    title: 'Callout',
    description: 'Highlighted info block',
    icon: <AlertCircle className="h-4 w-4" />,
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run()
    },
    aliases: ['info', 'warning', 'tip'],
  },
  {
    title: 'Toggle',
    description: 'Collapsible content',
    icon: <ToggleLeft className="h-4 w-4" />,
    command: (editor) => {
      editor.chain().focus().insertContent({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Toggle heading' }],
      }).run()
    },
    aliases: ['collapsible', 'accordion'],
  },
]

interface SlashMenuPopupProps {
  editor: Editor
  query: string
  onClose: () => void
  position: { top: number; left: number }
}

export function SlashMenuPopup({ editor, query, onClose, position }: SlashMenuPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = slashMenuItems.filter((item) => {
    const q = query.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.aliases?.some((a) => a.toLowerCase().includes(q))
    )
  })

  useEffect(() => setSelectedIndex(0), [query])

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectItem = useCallback((index: number) => {
    const item = filtered[index]
    if (!item) return
    // Delete the slash + query
    const { from, to } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - query.length - 1), from)
    const slashPos = textBefore.lastIndexOf('/')
    if (slashPos >= 0) {
      editor.chain()
        .deleteRange({ from: from - query.length - 1, to: from })
        .run()
    }
    item.command(editor)
    onClose()
  }, [filtered, editor, query, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        selectItem(selectedIndex)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, selectedIndex, selectItem, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      className="fixed z-[200] w-64 max-h-72 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div ref={listRef} className="py-1">
        {filtered.map((item, i) => (
          <button
            key={item.title}
            onClick={() => selectItem(i)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`flex items-center gap-3 w-full px-3 py-2 text-left cursor-pointer transition-colors ${
              i === selectedIndex ? 'bg-accent/10' : 'hover:bg-bg-hover'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-muted shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-text">{item.title}</div>
              <div className="text-[10px] text-text-muted truncate">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
