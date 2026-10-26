/**
 * 头部行程自动校准：把用户实际的头部上下行程放大到整个可玩区域。
 *
 * 引体/俯卧撑时头部在画面里只移动一小段（随机位摆放、距离而变），
 * 直接用头部原始高度会出现“手臂打直或拉到最高也够不到通道”。
 * 这里持续记录最近的最高/最低点，动作行程的中点映射到画面中线：
 * 引体拉到一半、俯卧撑下到一半时，小鸟正好在画面中央；
 * 完整一次动作覆盖 playSpan 指定的上下范围。
 */

export type HeadTravelRange = {
  high: number
  lastAt: number
  low: number
}

export type HeadTravelOptions = {
  /** 行程不足该值时按该值计算，避免静止时轻微抖动被过度放大。 */
  minRange: number
  /** 完整一次动作映射到画面中的比例，0.76 即 12%–88%。 */
  playSpan: number
  /** 最高/最低点每秒向当前位置回收的比例，用于适应换位或摆放变化。 */
  relaxPerSecond: number
}

export const HEAD_TRAVEL_DEFAULTS: HeadTravelOptions = {
  minRange: 0.16,
  playSpan: 0.76,
  relaxPerSecond: 0.1
}

const MAX_RELAX_GAP_MS = 1000
const STAGE_MIN_Y = 0.06
const STAGE_MAX_Y = 0.94

export function updateHeadTravel(
  range: HeadTravelRange | null,
  headY: number,
  now: number,
  options: HeadTravelOptions = HEAD_TRAVEL_DEFAULTS
): HeadTravelRange {
  if (!range) return { high: headY, lastAt: now, low: headY }

  const dtSeconds = Math.min(MAX_RELAX_GAP_MS, Math.max(0, now - range.lastAt)) / 1000
  const relax = 1 - Math.exp(-options.relaxPerSecond * dtSeconds)
  const relaxedLow = range.low + (headY - range.low) * relax
  const relaxedHigh = range.high + (headY - range.high) * relax

  return {
    high: Math.max(relaxedHigh, headY),
    lastAt: now,
    low: Math.min(relaxedLow, headY)
  }
}

export function mapHeadTravelToStage(
  range: HeadTravelRange | null,
  headY: number,
  options: HeadTravelOptions = HEAD_TRAVEL_DEFAULTS
) {
  if (!range) return 0.5
  const middle = (range.low + range.high) / 2
  const span = Math.max(options.minRange, range.high - range.low)
  const mapped = 0.5 + ((headY - middle) / span) * options.playSpan
  return Math.min(STAGE_MAX_Y, Math.max(STAGE_MIN_Y, mapped))
}
