/**
 * 哑铃弹弹：小哑铃在左右两块杠铃片之间匀速来回弹，每撞一次片子计 1 次，
 * 玩家喊停时停在几就做几个。速度只由玩家手动选的倍速决定，不会自己加速。
 *
 * 运动用一个连续的 phase 表示：phase 每跨过一个整数就撞一次片子，
 * floor(phase) 就是已撞次数。起点 0.5 = 两片中间、正往右飞。
 */

export type BounceStatus = 'idle' | 'countdown' | 'bouncing' | 'result'

export type BounceSpeed = 1 | 2 | 3

export const BOUNCE_SPEEDS: BounceSpeed[] = [1, 2, 3]

/** 1× 时每秒撞片次数。 */
export const BASE_HITS_PER_SECOND = 1.6
export const START_PHASE = 0.5
export const COUNTDOWN_MS = 3000
/** 玩家一直不喊停时的兜底时长，避免录制无限变长。 */
export const MAX_BOUNCE_MS = 60000

export type BounceExercise = {
  key: string
  label: string
}

export const BOUNCE_EXERCISES: BounceExercise[] = [
  { key: 'pushup', label: '俯卧撑' },
  { key: 'pullup', label: '引体向上' },
  { key: 'squat', label: '深蹲' },
  { key: 'dip', label: '臂屈伸' },
  { key: 'burpee', label: '波比跳' },
  { key: 'situp', label: '卷腹' }
]

/** 画面需要的全部状态；实时画布和合成录制都只看这一份快照。 */
export type BounceScene = {
  countdownMs: number
  exerciseLabel: string
  phase: number
  resultAgeMs: number
  status: BounceStatus
}

export function advancePhase(phase: number, deltaMs: number, speed: BounceSpeed) {
  const safeDelta = Math.max(0, deltaMs)
  return phase + (safeDelta / 1000) * BASE_HITS_PER_SECOND * speed
}

export function hitCount(phase: number) {
  return Math.max(0, Math.floor(phase))
}

/** 停下来时的“目标次数”：起点之前不算，停在半路也只算已经撞到的。 */
export function repsFromScene(scene: Pick<BounceScene, 'phase' | 'status'>) {
  if (scene.status === 'idle' || scene.status === 'countdown') return null
  return hitCount(scene.phase)
}

export type DumbbellPose = {
  /** 0 = 贴左片，1 = 贴右片。 */
  progress: number
  /** 刚撞到的一侧和撞击强度（0-1，用于片子抖动和数字放大）。 */
  impactSide: 'left' | 'right' | null
  impact: number
  /** 竖直方向的漂移，-1 到 1。 */
  drift: number
  /** 哑铃自身旋转角（弧度）。 */
  angle: number
}

const IMPACT_WINDOW = 0.18

export function dumbbellPose(phase: number): DumbbellPose {
  const segment = Math.floor(phase)
  const fraction = phase - segment
  // 偶数段从左往右飞，奇数段从右往左飞。
  const movingRight = segment % 2 === 0
  const progress = movingRight ? fraction : 1 - fraction
  // 段的起点就是刚撞完的那一侧；phase 还没到第一次撞击时不显示撞击。
  const impact = segment >= 1 && fraction < IMPACT_WINDOW ? 1 - fraction / IMPACT_WINDOW : 0
  const impactSide = impact > 0 ? (movingRight ? 'left' : 'right') : null
  const drift = Math.sin(phase * 1.7) * 0.6 + Math.sin(phase * 0.63 + 1.1) * 0.4
  const angle = Math.sin(phase * Math.PI) * 0.35 + Math.sin(phase * 0.41) * 0.2

  return { angle, drift, impact, impactSide, progress }
}
