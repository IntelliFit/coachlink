import Taro from '@tarojs/taro'
import { TODAY_TRAINING_PAGE_CACHE_KEY } from './todayTrainingPageCache'
import { TRAINING_EXECUTION_SNAPSHOT_KEY } from './trainingExecutionCache'

export const NEW_USER_AUDIT_STORAGE_KEY = 'coachlink_new_user_audit_mode_v1'

export function createAuditUser() {
  const now = Date.now()
  return {
    id: `audit-user-${now}`,
    nickname: '小白体验用户',
    name: '小白体验用户',
    role: 'student',
    primary_role: 'student',
    is_coach: false,
    is_admin: false,
    avatar_url: '',
    phone: '',
    email: '',
    onboarding_completed: false,
  }
}

export function enableNewUserAuditMode() {
  Taro.setStorageSync(NEW_USER_AUDIT_STORAGE_KEY, {
    enabled: true,
    startedAt: new Date().toISOString(),
  })
}

export function disableNewUserAuditMode() {
  Taro.removeStorageSync(NEW_USER_AUDIT_STORAGE_KEY)
}

export function clearMiniProgramAuth() {
  Taro.removeStorageSync('token')
  Taro.removeStorageSync('user')
}

export function clearBeginnerLocalCaches() {
  Taro.removeStorageSync(TODAY_TRAINING_PAGE_CACHE_KEY)
  Taro.removeStorageSync(TRAINING_EXECUTION_SNAPSHOT_KEY)
}

export function enterAuditStudentOnboarding(next = '/pages/index/index') {
  const user = createAuditUser()
  Taro.setStorageSync('token', `audit-token-${Date.now()}`)
  Taro.setStorageSync('user', user)
  enableNewUserAuditMode()
  Taro.reLaunch({
    url: `/auth/student-onboarding?audit=1&next=${encodeURIComponent(next)}`,
  })
}
