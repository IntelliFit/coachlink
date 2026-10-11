import Taro from '@tarojs/taro'
import { resolveApiBaseUrl, readMiniProgramEnvVersion } from '@/utils/apiBaseUrl'
import { TODAY_TRAINING_PAGE_CACHE_KEY } from '@/utils/todayTrainingPageCache'
import { SNAPSHOT_KEY } from '@/utils/trainingExecutionCache'

const DEBUG_KEY = 'coachlink_local_debug_session_v1'
const BACKUP_KEY = 'coachlink_local_debug_previous_auth_v1'
const isDebugToken = (token: unknown) => typeof token === 'string' && token.startsWith('cldev.')
export const localDebugApiUrl = () => resolveApiBaseUrl()
export function canUseLocalDebugLogin() {
  return process.env.NODE_ENV === 'development' && readMiniProgramEnvVersion() === 'develop' &&
    /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(localDebugApiUrl())
}

export type LocalDebugSession = {
  userId: string; name: string; expiresAt: number; apiBaseUrl: string; databaseFingerprint: string
}

export function getLocalDebugSession(): LocalDebugSession | null {
  if (!canUseLocalDebugLogin()) return null
  try {
    const token = Taro.getStorageSync('token')
    if (token && !isDebugToken(token)) return null
    const session = Taro.getStorageSync(DEBUG_KEY)
    return session?.userId && Number.isFinite(session.expiresAt) ? session : null
  } catch { return null }
}

function clearTrainingCache() {
  // Reuse existing keys and expiry policies. No parallel debug cache format.
  Taro.removeStorageSync(TODAY_TRAINING_PAGE_CACHE_KEY)
  Taro.removeStorageSync(SNAPSHOT_KEY)
}

export async function loginLocalDebugUser(userId: string, pairingCode: string) {
  if (!canUseLocalDebugLogin()) throw new Error('仅支持本地开发者工具，不支持体验版或正式版')
  if (Taro.getStorageSync(BACKUP_KEY) && !Taro.getStorageSync(DEBUG_KEY)) {
    throw new Error('存在未恢复的模拟登录，请先退出模拟')
  }
  // Do not use the general request logger: pairing codes and tokens are secrets.
  const response = await Taro.request({
    url: `${localDebugApiUrl()}/api/miniapp/local-debug-login`, method: 'POST',
    header: { 'Content-Type': 'application/json', 'x-coachlink-debug-code': pairingCode.trim() },
    data: { userId: userId.trim() }, timeout: 30000,
  })
  const result = response.data as { success?: boolean; message?: string; data?: { user: any; token: string; debug: LocalDebugSession } }
  const data = result?.data
  if (response.statusCode !== 200 || !result.success || !data?.user?.id || !isDebugToken(data.token) || data.debug?.userId !== userId.trim()) {
    throw new Error(result?.message || '模拟登录失败，原账号未切换')
  }
  const previous = { user: Taro.getStorageSync('user'), token: Taro.getStorageSync('token'), debug: Taro.getStorageSync(DEBUG_KEY) }
  const hadBackup = !!Taro.getStorageSync(BACKUP_KEY) && (!previous.token || isDebugToken(previous.token))
  try {
    if (!hadBackup) Taro.setStorageSync(BACKUP_KEY, { user: previous.user, token: isDebugToken(previous.token) ? '' : previous.token })
    Taro.setStorageSync(DEBUG_KEY, data.debug)
    Taro.setStorageSync('token', data.token)
    Taro.setStorageSync('user', data.user)
    clearTrainingCache()
  } catch (error) {
    Taro.setStorageSync('user', previous.user)
    Taro.setStorageSync('token', previous.token)
    if (previous.debug) Taro.setStorageSync(DEBUG_KEY, previous.debug)
    else Taro.removeStorageSync(DEBUG_KEY)
    if (!hadBackup) Taro.removeStorageSync(BACKUP_KEY)
    throw error
  }
  return data.debug
}

export async function exitLocalDebugLogin() {
  const backup = Taro.getStorageSync(BACKUP_KEY)
  if (!backup && !Taro.getStorageSync(DEBUG_KEY) && !isDebugToken(Taro.getStorageSync('token'))) return
  // Restore credentials first; keep the backup if storage restoration fails.
  if (backup?.user && backup?.token) {
    Taro.setStorageSync('user', backup.user)
    Taro.setStorageSync('token', backup.token)
  } else {
    Taro.removeStorageSync('user')
    Taro.removeStorageSync('token')
  }
  clearTrainingCache()
  Taro.removeStorageSync(DEBUG_KEY)
  Taro.removeStorageSync(BACKUP_KEY)
  await Taro.reLaunch({ url: backup?.token ? '/pages/index/index' : '/auth/login' })
}
