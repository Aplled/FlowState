import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNodeStore } from '@/stores/node-store'
import { useFolderStore } from '@/stores/folder-store'

export function useRealtimeSync(workspaceId: string | null) {
  const fetchNodes = useNodeStore((s) => s.fetchNodes)
  const fetchConnections = useNodeStore((s) => s.fetchConnections)

  useEffect(() => {
    if (!workspaceId) return

    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nodes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchNodes(workspaceId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchConnections(workspaceId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, fetchNodes, fetchConnections])
}

export function useRealtimeFolders() {
  const fetchFolders = useFolderStore((s) => s.fetchFolders)

  useEffect(() => {
    const channel = supabase
      .channel('folders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        () => {
          fetchFolders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchFolders])
}
