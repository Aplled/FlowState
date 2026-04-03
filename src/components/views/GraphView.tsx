import { Network } from 'lucide-react'

export function GraphView() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Network className="mx-auto h-12 w-12 text-text-muted" />
        <h2 className="text-lg font-medium text-text">Graph View</h2>
        <p className="text-sm text-text-muted">
          Visualize connections between all your nodes across workspaces.
        </p>
      </div>
    </div>
  )
}
