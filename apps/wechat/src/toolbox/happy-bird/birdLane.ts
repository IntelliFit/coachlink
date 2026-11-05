import type { Lane } from './birdTypes'

/**
 * 小鸟 1:1 跟着眼睛走，不放大；门迁就人：开局后记录眼睛实际上下的范围，门的通道都放在这个范围里。
 * 用分位数而不是最高最低点，一两帧识别跳动不会把范围撑大，让门跑到够不着的地方。
 * 纯函数，样本数组每次返回新的。
 */

export const LANE_SAMPLE_LIMIT = 600
/** 头几乎不动时也留一点上下，门不至于全挤在一条线上。 */
export const MIN_LANE_HALF_SPAN = 0.08
/** 和原来整屏可玩范围一致：12%–88%。 */
export const MAX_LANE_HALF_SPAN = 0.38
const LOW_PERCENTILE = 0.08
const HIGH_PERCENTILE = 0.92
const EDGE_MARGIN = 0.1

export function addLaneSample(samples: number[], eyeY: number) {
  const next = samples.length >= LANE_SAMPLE_LIMIT ? samples.slice(samples.length - LANE_SAMPLE_LIMIT + 1) : samples.slice()
  next.push(eyeY)
  return next
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.min(sorted.length - 1, lower + 1)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/** 还没有样本时以当前眼睛高度为中心。 */
export function laneFromSamples(samples: number[], fallbackY: number): Lane {
  if (!samples.length) return { center: clampCenter(fallbackY, MIN_LANE_HALF_SPAN), halfSpan: MIN_LANE_HALF_SPAN }
  const sorted = [...samples].sort((a, b) => a - b)
  const low = percentile(sorted, LOW_PERCENTILE)
  const high = percentile(sorted, HIGH_PERCENTILE)
  const halfSpan = Math.min(MAX_LANE_HALF_SPAN, Math.max(MIN_LANE_HALF_SPAN, (high - low) / 2))
  return { center: clampCenter((low + high) / 2, halfSpan), halfSpan }
}

/** 通道整体留在画面里：人站得太靠上或太靠下时，门也不会贴到屏幕外。 */
function clampCenter(center: number, halfSpan: number) {
  const min = Math.min(0.5, EDGE_MARGIN + halfSpan)
  const max = Math.max(0.5, 1 - EDGE_MARGIN - halfSpan)
  return Math.min(max, Math.max(min, center))
}
