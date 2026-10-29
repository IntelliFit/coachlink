import { useEffect, useRef } from 'react'
import { resolveCoachLinkAppRole } from '@coachlink/core'
import { apiClient } from '../../api'
import { rootNavigationRef } from '../../navigation/navigationRef'
import { requiresStudentOnboarding } from './onboardingModel'

/**
 * 登录后检查是否需要新用户引导（与小程序 studentOnboardingService.resolvePostLoginUrl 一致）。
 * 每个账号每次启动只检查一次；读取资料失败时不打断用户。
 */
export function useOnboardingGate(params: { isAuthenticated: boolean; isBootstrapping: boolean; user: any }) {
  const checkedUserRef = useRef('')
  const { isAuthenticated, isBootstrapping, user } = params

  useEffect(() => {
    const userId = user?.id ? String(user.id) : ''
    if (isBootstrapping || !isAuthenticated || !userId || checkedUserRef.current === userId) return
    checkedUserRef.current = userId
    const role = resolveCoachLinkAppRole(user) === 'coach' ? 'coach' : 'student'
    // 教练端和管理员不进引导，也不用请求资料
    if (role === 'coach' || user?.is_admin) return
    let cancelled = false
    apiClient.request<{ profile?: Record<string, any> | null }>('/api/user/get-student-profile', { method: 'POST', body: { userId }, timeoutMs: 12_000 })
      .then((data) => {
        if (cancelled || !requiresStudentOnboarding(data?.profile ?? null, user, role)) return
        const open = () => {
          if (rootNavigationRef.isReady()) rootNavigationRef.navigate('StudentOnboarding')
          else setTimeout(open, 300)
        }
        open()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isBootstrapping, user])
}
