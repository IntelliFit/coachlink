import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { AuthSession, CoachLinkUser } from '@coachlink/core'
import { apiClient, getStoredUser, hasStoredToken } from '../api'
import { DEV_USERS, type DevUser } from '../../../../src/config/devUsers'

type AuthContextValue = {
  isBootstrapping: boolean
  isAuthenticated: boolean
  isGuest: boolean
  user: CoachLinkUser | null
  loginWithPassword: (phoneOrEmail: string, password: string) => Promise<void>
  loginWithCode: (phoneOrEmail: string, verifyCode: string) => Promise<void>
  register: (phoneOrEmail: string, password: string, verifyCode: string, invitationCode?: string) => Promise<void>
  continueAsGuest: () => void
  loginAsDevUser: (devUser?: DevUser) => Promise<void>
  refreshUser: () => Promise<void>
  setLocalUser: (user: CoachLinkUser | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [user, setUser] = useState<CoachLinkUser | null>(null)

  useEffect(() => {
    Promise.all([hasStoredToken(), getStoredUser()])
      .then(([hasToken, storedUser]) => {
        setIsAuthenticated(hasToken)
        setUser(hasToken ? storedUser : null)
      })
      .finally(() => setIsBootstrapping(false))
  }, [])

  const markAuthenticated = useCallback((session: AuthSession) => {
    setIsAuthenticated(Boolean(session.token && session.user?.id))
    setIsGuest(false)
    setUser(session.user)
  }, [])

  const loginWithPassword = useCallback(async (phoneOrEmail: string, password: string) => {
    markAuthenticated(await apiClient.loginWithPassword({ phoneOrEmail, password }))
  }, [markAuthenticated])

  const loginWithCode = useCallback(async (phoneOrEmail: string, verifyCode: string) => {
    markAuthenticated(await apiClient.loginWithCode({ phoneOrEmail, verifyCode }))
  }, [markAuthenticated])

  const register = useCallback(async (phoneOrEmail: string, password: string, verifyCode: string, invitationCode?: string) => {
    markAuthenticated(await apiClient.register({ phoneOrEmail, password, verifyCode, invitationCode }))
  }, [markAuthenticated])

  const continueAsGuest = useCallback(() => {
    setIsGuest(true)
  }, [])

  const refreshUser = useCallback(async () => {
    const storedUser = await getStoredUser()
    setUser(storedUser)
  }, [])

  const loginAsDevUser = useCallback(async (devUser?: DevUser) => {
    const target = devUser || DEV_USERS[0]
    if (!target) {
      throw new Error('未配置开发测试账号')
    }
    await loginWithPassword(target.phone, target.password)
  }, [loginWithPassword])

  const logout = useCallback(async () => {
    await apiClient.clearSession()
    setIsAuthenticated(false)
    setIsGuest(false)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    isBootstrapping,
    isAuthenticated,
    isGuest,
    user,
    loginWithPassword,
    loginWithCode,
    register,
    continueAsGuest,
    loginAsDevUser,
    refreshUser,
    setLocalUser: setUser,
    logout,
  }), [isBootstrapping, isAuthenticated, isGuest, user, loginWithPassword, loginWithCode, register, continueAsGuest, loginAsDevUser, refreshUser, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
