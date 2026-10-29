import { Alert } from 'react-native'
import { API_BASE_URL } from '../../config'
import { openExternalUrl } from '../../externalLinks'
import { resolveWeappPathToAppTarget, resolveWebPathToUrl } from '../../notifications/announcementLinks'
import type { UserAnnouncement } from '../../notifications/announcementFeed'

type Navigator = {
  navigate: (...args: any[]) => void
}

export type AnnouncementActionPlan =
  | { type: 'app'; run: (navigation: Navigator) => void }
  | { type: 'web'; url: string }
  | { type: 'switch-role'; role: 'student' | 'coach' }
  | null

/** 详情页按钮去哪：优先 APP 原生页面，其次网页；身份不匹配的 Tab 页提示切换身份。 */
export function planAnnouncementAction(item: Pick<UserAnnouncement, 'actionLabel' | 'weappPath' | 'webPath'>, isCoachMode: boolean): AnnouncementActionPlan {
  if (!item.actionLabel) return null
  const target = resolveWeappPathToAppTarget(item.weappPath)
  const webUrl = resolveWebPathToUrl(item.webPath, API_BASE_URL)
  if (target?.kind === 'stack') {
    return { type: 'app', run: (navigation) => navigation.navigate(target.name, target.params) }
  }
  if (target?.kind === 'tab') {
    const currentMode = isCoachMode ? 'coach' : 'student'
    if (target.mode === currentMode) {
      return { type: 'app', run: (navigation) => navigation.navigate('MainTabs', { screen: target.tab }) }
    }
    if (webUrl) return { type: 'web', url: webUrl }
    return { type: 'switch-role', role: target.mode }
  }
  return webUrl ? { type: 'web', url: webUrl } : null
}

export function runAnnouncementAction(plan: AnnouncementActionPlan, navigation: Navigator) {
  if (!plan) return
  if (plan.type === 'app') {
    plan.run(navigation)
    return
  }
  if (plan.type === 'web') {
    void openExternalUrl(plan.url, { errorMessage: '暂时无法打开该页面，请稍后重试。' })
    return
  }
  Alert.alert('需要切换身份', plan.role === 'coach' ? '该页面在教练端，请先在「我的」中切换到教练端。' : '该页面在学员端，请先在「我的」中切换到学员端。')
}
