import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearAccessToken, csrfHeader, refreshAccessToken, setAccessToken } from '../lib/api'
import type { ApiResponse, SessionUser } from '../types/api'
import { AuthContext, type AuthContextValue } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const restoreSession = useCallback(async () => {
    try {
      await refreshAccessToken()
      const response = await api.get<ApiResponse<SessionUser>>('/auth/session')
      setUser(response.data.data)
    } catch {
      clearAccessToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreSession()
    const expire = () => setUser(null)
    window.addEventListener('auth:expired', expire)
    return () => window.removeEventListener('auth:expired', expire)
  }, [restoreSession])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<
      ApiResponse<{ accessToken: string; user: SessionUser }>
    >('/auth/login', { email, password })
    setAccessToken(response.data.data.accessToken)
    setUser(response.data.data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { headers: csrfHeader() })
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      hasPermission: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [loading, login, logout, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
