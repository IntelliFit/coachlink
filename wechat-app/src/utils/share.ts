import Taro from '@tarojs/taro'

type ShareParamValue = string | number | boolean | null | undefined

export interface SharePayload {
  title: string
  path: string
  imageUrl?: string
}

interface ShareMenuOptions {
  withShareTicket?: boolean
  includeTimeline?: boolean
}

const DEFAULT_SHARE_PATH = '/pages/index/index'

const buildQueryString = (params?: Record<string, ShareParamValue>) => {
  if (!params) return ''

  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    search.append(key, String(value))
  })
  return search.toString()
}

export const buildSharePath = (
  basePath: string,
  params?: Record<string, ShareParamValue>
) => {
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`
  const query = buildQueryString(params)
  return query ? `${normalizedPath}?${query}` : normalizedPath
}

export const splitSharePath = (path: string) => {
  const normalizedPath = path || DEFAULT_SHARE_PATH
  const [pagePath, query = ''] = normalizedPath.split('?')
  return {
    path: pagePath || DEFAULT_SHARE_PATH,
    query
  }
}

export const buildPublicTrainingSharePath = (shareToken?: string | null) => {
  const token = String(shareToken || '').trim()
  if (!token) return ''
  return buildSharePath('/content/public/training', { token })
}

export const openCoachLinkShareMenu = (options?: ShareMenuOptions) => {
  const includeTimeline = options?.includeTimeline ?? true
  Taro.showShareMenu({
    withShareTicket: options?.withShareTicket ?? true,
    // @ts-ignore 微信小程序支持 menus，Taro 类型未完整暴露
    menus: includeTimeline ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage']
  })
}

export const createSharePayload = (options: SharePayload): SharePayload => ({
  title: options.title.trim(),
  path: options.path || DEFAULT_SHARE_PATH,
  imageUrl: options.imageUrl
})

export const createTimelinePayload = (options: SharePayload) => {
  const normalized = createSharePayload(options)
  const { query } = splitSharePath(normalized.path)
  return {
    title: normalized.title,
    query,
    imageUrl: normalized.imageUrl
  }
}

export const getPublicTrainingShareTitle = (nickname?: string, planName?: string) => {
  const safeNickname = String(nickname || '').trim()
  const safePlanName = String(planName || '').trim()

  if (safeNickname && safePlanName) {
    return `${safeNickname} 完成了「${safePlanName}」训练`
  }
  if (safeNickname) {
    return `${safeNickname} 完成了一次训练打卡`
  }
  if (safePlanName) {
    return `我在 CoachLink 完成了「${safePlanName}」训练`
  }
  return '我在 CoachLink 完成了一次训练打卡'
}

export const getTodayTrainingShareTitle = (planName?: string, dayIndex?: number | null) => {
  const safePlanName = String(planName || '').trim()
  const safeDayIndex = Number(dayIndex || 0)

  if (safePlanName && safeDayIndex > 0) {
    return `我在 CoachLink 完成了 ${safePlanName} 第 ${safeDayIndex} 天打卡`
  }
  if (safePlanName) {
    return `我在 CoachLink 更新了 ${safePlanName} 的训练打卡`
  }
  return '我在 CoachLink 更新了今天的训练打卡'
}

export const getToolboxShareTitle = () => 'CoachLink 工具箱：训练、计算与场景急救一站搞定'

export const getReferralShareTitle = (shareText?: string) => {
  const normalized = String(shareText || '').trim()
  if (!normalized) return '一起加入 CoachLink 训练'
  return normalized.split('\n')[0].trim() || '一起加入 CoachLink 训练'
}
