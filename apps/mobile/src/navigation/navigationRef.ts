import { createNavigationContainerRef } from '@react-navigation/native'
import type { NotificationTarget } from '../notifications/notificationTargets'
import type { RootStackParamList } from './types'

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>()

let pendingTarget: NotificationTarget | null = null
let pendingAfterLogin: { name: keyof RootStackParamList; params?: object; at: number } | null = null

const AFTER_LOGIN_TTL_MS = 10 * 60 * 1000

/**
 * 登录成功后导航栈会重建，游客停留的页面就没了。先记下来，登录后回到这里。
 * 放弃登录的话，过一会儿再登录不应该被带回去，所以有有效期。
 */
export function returnHereAfterLogin<Name extends keyof RootStackParamList>(name: Name, params?: RootStackParamList[Name]) {
  pendingAfterLogin = { name, params: params as object | undefined, at: Date.now() }
}

/** 冷启动点通知时导航还没就绪，先记下目标，就绪且已登录后再跳。 */
export function queueNotificationTarget(target: NotificationTarget) {
  pendingTarget = target
}

export function flushPendingNotificationTarget(isAuthenticated: boolean) {
  if (!isAuthenticated || !rootNavigationRef.isReady()) return false
  const afterLogin = pendingAfterLogin
  pendingAfterLogin = null
  if (!pendingTarget) {
    if (!afterLogin || Date.now() - afterLogin.at > AFTER_LOGIN_TTL_MS) return false
    // 等重建后的导航栈挂载完再跳
    setTimeout(() => {
      if (rootNavigationRef.isReady()) rootNavigationRef.navigate(afterLogin.name as any, afterLogin.params as any)
    }, 0)
    return true
  }
  const target = pendingTarget
  pendingTarget = null
  if ('params' in target && target.params) {
    rootNavigationRef.navigate(target.name as any, target.params as any)
  } else {
    rootNavigationRef.navigate(target.name as any)
  }
  return true
}
