import type { PublicTrainingActionSummary } from '@coachlink/core/src/publicTrainingSummary'

/** 训练分享页的数据整理和分享文案，内容与小程序公开训练页一致。 */

export type TrainingShareData = {
  planName: string
  completedAt: string
  totalVolume: number
  totalSets: number
  durationMinutes: number
  prCount: number
  nickname: string
  avatarUrl: string
  shareToken: string
  actions: PublicTrainingActionSummary[]
}

/** share-info 负责 token 和 PR；公开接口带逐个动作。公开接口失败时仍可显示和分享汇总。 */
export function mergeTrainingShare(shareInfo: any, publicTraining: any): TrainingShareData {
  const source = publicTraining || shareInfo || {}
  const user = source.user || shareInfo?.user || {}
  return {
    planName: String(source.planName || ''),
    completedAt: String(source.completedAt || ''),
    totalVolume: Number(source.totalVolume) || 0,
    totalSets: Number(source.totalSets) || 0,
    durationMinutes: Number(source.durationMinutes) || 0,
    prCount: Array.isArray(shareInfo?.prRecords) ? shareInfo.prRecords.length : 0,
    nickname: String(user.nickname || ''),
    avatarUrl: String(user.avatarUrl || ''),
    shareToken: String(shareInfo?.shareToken || ''),
    actions: Array.isArray(publicTraining?.actionExecutions) ? publicTraining.actionExecutions : [],
  }
}

export function volumeInTons(volume: number) {
  return Math.round((volume / 1000) * 10) / 10
}

/** 北京时间，如 2026/10/31 14:33 */
export function formatShareDateTime(input: string) {
  if (!input) return ''
  const time = new Date(input).getTime()
  if (Number.isNaN(time)) return input
  return new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ').replace(/-/g, '/')
}

export function publicTrainingUrl(baseUrl: string, shareToken: string) {
  return shareToken ? `${baseUrl.replace(/\/+$/, '')}/public/training/${encodeURIComponent(shareToken)}` : ''
}

export function trainingShareTitle(nickname?: string, planName?: string) {
  const safeNickname = String(nickname || '').trim()
  const safePlanName = String(planName || '').trim()
  if (safeNickname && safePlanName) return `${safeNickname} 完成了「${safePlanName}」训练`
  if (safeNickname) return `${safeNickname} 完成了一次训练打卡`
  if (safePlanName) return `我在 CoachLink 完成了「${safePlanName}」训练`
  return '我在 CoachLink 完成了一次训练打卡'
}

export function buildTrainingShareText(data: TrainingShareData, baseUrl: string) {
  const stats = [`总容量 ${volumeInTons(data.totalVolume)} 吨`, `${data.totalSets} 组`]
  if (data.durationMinutes > 0) stats.push(`${data.durationMinutes} 分钟`)
  if (data.prCount > 0) stats.push(`PR ${data.prCount} 项`)
  return [
    trainingShareTitle(data.nickname, data.planName),
    formatShareDateTime(data.completedAt),
    stats.join(' · '),
    publicTrainingUrl(baseUrl, data.shareToken),
  ].filter(Boolean).join('\n')
}

/** react-native-svg 只需要 svg 本体，去掉 XML 声明和注释。 */
export function stripSvgProlog(svg: string) {
  return svg.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim()
}
