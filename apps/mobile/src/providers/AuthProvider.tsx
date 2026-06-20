import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { AuthSession } from '@coachlink/core'
import { apiClient, hasStoredToken } from '../api'

type AuthContextValue = {
  isBootstrapping: boolean
  isAuthenticated: boolean
  loginWithPassword: (phoneOrEmail: string, password: string) => Promise<void>
  loginWithCode: (phoneOrEmail: string, verifyCode: string) => Promise<void>
  register: (phoneOrEmail: string, password: string, verifyCode: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    hasStoredToken()
      .then(setIsAuthenticated)
      .finally(() => setIsBootstrapping(false))
  }, [])

  const markAuthenticated = useCallback((session: AuthSession) => {
    setIsAuthenticated(Boolean(session.token && session.user?.id))
  }, [])

  const loginWithPassword = useCallback(async (phoneOrEmail: string, password: string) => {
    markAuthenticated(await apiClient.loginWithPassword({ phoneOrEmail, password }))
  }, [markAuthenticated])

  const loginWithCode = useCallback(async (phoneOrEmail: string, verifyCode: string) => {
    markAuthenticated(await apiClient.loginWithCode({ phoneOrEmail, verifyCode }))
  }, [markAuthenticated])

  const register = useCallback(async (phoneOrEmail: string, password: string, verifyCode: string) => {
    markAuthenticated(await apiClient.register({ phoneOrEmail, password, verifyCode }))
  }, [markAuthenticated])

  const logout = useCallback(async () => {
    await apiClient.clearSession()
    setIsAuthenticated(false)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    isBootstrapping,
    isAuthenticated,
    loginWithPassword,
    loginWithCode,
    register,
    logout,
  }), [isBootstrapping, isAuthenticated, loginWithPassword, loginWithCode, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
