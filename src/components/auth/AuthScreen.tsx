import { useState } from 'react'
import { useAuth } from '@/lib/auth'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName)
        setSignUpSuccess(true)
      } else {
        await signIn(email, password)
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-bold text-text">FlowState</h1>
        <p className="mb-6 text-sm text-text-muted">
          {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {signUpSuccess ? (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-sm text-accent">
            Check your email for a confirmation link, then sign in.
            <button
              onClick={() => { setMode('signin'); setSignUpSuccess(false) }}
              className="mt-3 block w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent/90 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        )}

        {!signUpSuccess && (
          <p className="mt-4 text-center text-xs text-text-muted">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              className="text-accent hover:underline cursor-pointer"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
