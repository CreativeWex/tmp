import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, login, setToken } from '@/lib/api'
import type { User, UserRole } from '@/lib/types'

interface AuthState {
  user: User | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const u = await fetchMe()
    setUser(u)
  }, [])

  useEffect(() => {
    const t = localStorage.getItem('bt_token')
    if (!t) {
      setReady(true)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { access_token } = await login(email, password)
    setToken(access_token)
    await refresh()
  }, [refresh])

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, refresh }),
    [user, ready, signIn, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export function useRequireRole(...roles: UserRole[]) {
  const { user } = useAuth()
  return user && roles.includes(user.role)
}
