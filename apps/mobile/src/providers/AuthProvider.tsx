import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { canSwitchCoachLinkAppRole, type AuthSession, type CoachLinkAppRole, type CoachLinkUser } from '@coachlink/core'
import { apiClient, clearMobileAppCache, getStoredUser, hasStoredToken, persistStoredUser } from '../api'
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
  switchRole: (role: CoachLinkAppRole) => Promise<CoachLinkUser>
  clearLocalCache: () => Promise<number>
  deleteAccount: (confirmationText: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [user, setUser] = useState<CoachLinkUser | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      let hasToken = false
      let storedUser: CoachLinkUser | null = null

      try {
        ;[hasToken, storedUser] = await Promise.all([hasStoredToken(), getStoredUser()])
      } catch {
        hasToken = false
        storedUser = null
      }

      const canRestore = hasToken && Boolean(storedUser?.id)
      if (!cancelled) {
        setIsAuthenticated(canRestore)
        setUser(canRestore ? storedUser : null)
        setIsBootstrapping(false)
      }

      if (!canRestore) {
        if (hasToken || storedUser) {
          await Promise.all([apiClient.clearSession(), clearMobileAppCache()]).catch(() => undefined)
        }
        return
      }

      let invalidSession = false
      try {
        const probe = await apiClient.request<{ userId?: string }>('/api/miniapp/session', {
          method: 'GET',
          timeoutMs: 6000,
        })
        invalidSession = !probe?.userId || probe.userId !== storedUser?.id
      } catch (error) {
        const message = error instanceof Error ? error.message.trim().toLowerCase() : ''
        invalidSession = message === 'unauthorized' || message.includes('登录已失效') || message.includes('登录已过期')
      }

      if (!invalidSession) return

      await Promise.all([apiClient.clearSession(), clearMobileAppCache()]).catch(() => undefined)
      if (!cancelled) {
        setIsAuthenticated(false)
        setIsGuest(false)
        setUser(null)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
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

  const switchRole = useCallback(async (role: CoachLinkAppRole) => {
    if (!user?.id) throw new Error('请先登录后再切换身份')
    if (!canSwitchCoachLinkAppRole(user, role)) {
      throw new Error('当前账号还没有教练权限，请先提交教练申请')
    }

    const result = await apiClient.request<{ primary_role: string }>('/api/user/switch-role', {
      method: 'POST',
      body: { role },
      timeoutMs: 12000,
    })
    if (result?.primary_role !== role) throw new Error('服务端返回的身份状态异常，请重试')

    const nextUser: CoachLinkUser = { ...user, primary_role: role }
    await persistStoredUser(nextUser)
    setUser(nextUser)
    return nextUser
  }, [user])

  const clearLocalCache = useCallback(() => clearMobileAppCache(), [])

  const clearLocalSession = useCallback(async () => {
    await Promise.all([apiClient.clearSession(), clearMobileAppCache()])
    setIsAuthenticated(false)
    setIsGuest(false)
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async (confirmationText: string) => {
    await apiClient.request('/api/user/delete-account', {
      method: 'POST',
      body: { confirmationText },
      timeoutMs: 15000,
    })
    await clearLocalSession()
  }, [clearLocalSession])

  const logout = useCallback(async () => {
    await clearLocalSession()
  }, [clearLocalSession])

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
    switchRole,
    clearLocalCache,
    deleteAccount,
    logout,
  }), [isBootstrapping, isAuthenticated, isGuest, user, loginWithPassword, loginWithCode, register, continueAsGuest, loginAsDevUser, refreshUser, switchRole, clearLocalCache, deleteAccount, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
