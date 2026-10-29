import { createNavigationContainerRef } from '@react-navigation/native'
import type { NotificationTarget } from '../notifications/notificationTargets'
import type { RootStackParamList } from './types'

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>()

let pendingTarget: NotificationTarget | null = null

/** 冷启动点通知时导航还没就绪，先记下目标，就绪且已登录后再跳。 */
export function queueNotificationTarget(target: NotificationTarget) {
  pendingTarget = target
}

export function flushPendingNotificationTarget(isAuthenticated: boolean) {
  if (!isAuthenticated || !pendingTarget || !rootNavigationRef.isReady()) return false
  const target = pendingTarget
  pendingTarget = null
  if ('params' in target && target.params) {
    rootNavigationRef.navigate(target.name as any, target.params as any)
  } else {
    rootNavigationRef.navigate(target.name as any)
  }
  return true
}
