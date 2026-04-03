import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FlowNode } from '@/types/database'
import { Search } from 'lucide-react'

export function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FlowNode[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .textSearch('data', query)
      .limit(50)
    setResults((data as FlowNode[] | null) ?? [])
    setLoading(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-text">Search</h1>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search across all nodes..."
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text placeholder-text-muted outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Search
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {results.map((node) => (
          <div key={node.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent-muted px-1.5 py-0.5 text-xs text-accent capitalize">
                {node.type}
              </span>
              <span className="text-xs text-text-muted">
                {new Date(node.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary line-clamp-2">
              {JSON.stringify(node.data).slice(0, 200)}
            </p>
          </div>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="py-12 text-center text-sm text-text-muted">No results found</p>
        )}
      </div>
    </div>
  )
}
