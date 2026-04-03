import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { AuthPage } from '@/components/auth/AuthPage'
import { AppLayout } from '@/components/layout/AppLayout'

function App() {
  const { user, initialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-text-muted">Loading FlowState...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return <AppLayout />
}

export default App
