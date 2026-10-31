import type { BojiSex } from '@coachlink/core/src/bojiDetector'
import { isBojiScoreId, type BojiScoreSnapshot } from '@coachlink/core/src/bojiInsights'

/** 薄肌检测器的请求和展示小工具，与小程序 bojiDetectorService / toolbox/boji 一致。 */

export const BOJI_MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const BOJI_ANALYZE_TIMEOUT_MS = 120_000

const BOJI_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** 服务端只收这几种，选图结果没带类型时按 JPEG 发。 */
export function bojiContentType(mimeType: string | null | undefined) {
  const type = String(mimeType || '').toLowerCase()
  return BOJI_CONTENT_TYPES.includes(type) ? type : 'image/jpeg'
}

export { withTimeout } from '../../withTimeout'

/** challenge：应战好友 PK 时对方的成绩 id；sex：female 用女性档打分。 */
export function analyzeBojiQuery(challengeId: string | null | undefined, sex: BojiSex) {
  const parts: string[] = []
  if (isBojiScoreId(challengeId)) parts.push(`challenge=${challengeId}`)
  if (sex === 'female') parts.push('sex=female')
  return parts.length ? `?${parts.join('&')}` : ''
}

export function bojiUploadError(size: number | null | undefined) {
  return typeof size === 'number' && size > BOJI_MAX_UPLOAD_BYTES ? '照片太大了，请换一张或裁剪后再试' : ''
}

export function bojiDetailSummary(snapshot: BojiScoreSnapshot) {
  const parts: string[] = []
  if (snapshot.sex === 'female' && snapshot.waistHipRatio !== null) parts.push(`腰臀比 ${snapshot.waistHipRatio.toFixed(2)}`)
  if (snapshot.shoulderWaistRatio !== null) parts.push(`肩腰比 ${snapshot.shoulderWaistRatio.toFixed(2)}`)
  if (snapshot.sex === 'male' && snapshot.upperArmRatio !== null) parts.push(`上臂宽/长 ${snapshot.upperArmRatio.toFixed(2)}`)
  if (snapshot.silhouetteIou !== null) parts.push(`轮廓重合 ${Math.round(snapshot.silhouetteIou * 100)}%`)
  return parts.join(' · ')
}
