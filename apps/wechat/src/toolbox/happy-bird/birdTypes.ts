/** 快乐小鸟的数据结构、关卡表和可调数值，规则本身在 birdModel.ts。 */

export type BirdStatus = 'idle' | 'countdown' | 'playing' | 'crashing' | 'result'

export type BirdEventType =
  | 'bump'
  | 'coin'
  | 'countdownTick'
  | 'fever'
  | 'gameOver'
  | 'go'
  | 'hit'
  | 'level'
  | 'pass'
  | 'perfect'
  | 'rep'
  | 'shieldBreak'
  | 'shieldUp'
  | 'smash'

export type BirdEvent = { type: BirdEventType; value?: number }

export type GateSwing = { amplitude: number; periodMs: number; phaseMs: number }

export type GateObstacle = {
  center: number
  gapHeight: number
  ghosted: boolean
  id: number
  kind: 'gate'
  passed: boolean
  swing: GateSwing | null
  warmup: boolean
  width: number
  x: number
}

export type SpinnerObstacle = {
  angle: number
  ghosted: boolean
  halfLength: number
  id: number
  kind: 'spinner'
  omega: number
  passed: boolean
  warmup: boolean
  x: number
  y: number
}

export type Obstacle = GateObstacle | SpinnerObstacle

export type Pickup = {
  id: number
  kind: 'coin' | 'shaker'
  x: number
  y: number
}

export type FxKind = 'feather' | 'plate' | 'puff' | 'ring' | 'text'

export type Fx = {
  color: string
  gravity: number
  id: number
  kind: FxKind
  lifeMs: number
  maxLifeMs: number
  rotation: number
  size: number
  spin: number
  text?: string
  vx: number
  vy: number
  x: number
  y: number
}

/** 门的通道放在哪一段高度：中心和上下半宽，都以画面高度为 1。 */
export type Lane = { center: number; halfSpan: number }

export type Banner = { ageMs: number; sub: string; text: string; tone: 'fever' | 'level' }

export type BirdGame = {
  aspect: number
  banner: Banner | null
  bestCombo: number
  bird: { flapMs: number; rotation: number; vy: number; y: number }
  coins: number
  combo: number
  distanceToNext: number
  elapsedMs: number
  feverMs: number
  fx: Fx[]
  gatesPassed: number
  gatesSpawned: number
  gatesUntilShaker: number
  goMs: number
  hitFlashMs: number
  invincibleMs: number
  lane: Lane
  lastSide: -1 | 1
  level: number
  lives: number
  nextFeverCombo: number
  nextId: number
  obstacles: Obstacle[]
  paused: boolean
  perfectFlashMs: number
  perfects: number
  pickups: Pickup[]
  repPhase: 'high' | 'low' | null
  repTransitions: number
  reps: number
  rng: number
  routeY: number | null
  score: number
  scorePopMs: number
  shakeMs: number
  shield: boolean
  speed: number
  status: BirdStatus
  statusMs: number
  tracking: boolean
}

export type BirdInput = {
  /** 门的通道；不给就沿用上一次。 */
  lane?: Lane
  /** 小鸟目标高度（0–1），就是眼睛在画面里的高度；没有头部数据时为 null，小鸟停在原位。 */
  targetY: number | null
  tracking: boolean
}

export type BirdStep = { events: BirdEvent[]; game: BirdGame }

export type LevelConfig = {
  amplitude: number
  gapHeight: number
  moverChance: number
  name: string
  spacing: number
  speed: number
  spinnerChance: number
}

export const COUNTDOWN_MS = 5000
export const BIRD_X = 0.24
/** 关卡表里门的上下摆幅是按这条整屏通道写的；实际通道更窄时按比例缩。 */
export const DEFAULT_LANE: Lane = { center: 0.5, halfSpan: 0.38 }
/** 小鸟画面半径（宽度单位）；命中半径明显更小，擦边不算撞，手感才宽容。 */
export const BIRD_RADIUS = 0.066
export const BIRD_HIT_RADIUS = 0.04
export const MAX_LIVES = 3
/** 前几道门撞了不扣命：先让人搞清楚小鸟怎么跟着自己动，不会几秒就结束。 */
export const WARMUP_GATES = 6
export const GATE_WIDTH = 0.17
export const GATES_PER_LEVEL = 8
export const FEVER_MS = 6000
export const FIRST_FEVER_COMBO = 10
export const FEVER_COMBO_STEP = 12
export const COIN_SCORE = 5
export const GATE_SCORE = 10
export const PERFECT_SCORE = 20
export const REP_SCORE = 5
export const SPINNER_THICKNESS = 0.05

export const LEVELS: LevelConfig[] = [
  { amplitude: 0.14, gapHeight: 0.36, moverChance: 0, name: '热身', spacing: 0.56, speed: 0.24, spinnerChance: 0 },
  { amplitude: 0.18, gapHeight: 0.33, moverChance: 0, name: '加速', spacing: 0.54, speed: 0.28, spinnerChance: 0 },
  { amplitude: 0.2, gapHeight: 0.31, moverChance: 0.35, name: '摇摆门', spacing: 0.52, speed: 0.31, spinnerChance: 0 },
  { amplitude: 0.22, gapHeight: 0.3, moverChance: 0.25, name: '飞天杠铃', spacing: 0.52, speed: 0.33, spinnerChance: 0.25 },
  { amplitude: 0.24, gapHeight: 0.27, moverChance: 0.3, name: '窄门', spacing: 0.5, speed: 0.36, spinnerChance: 0.25 },
  { amplitude: 0.26, gapHeight: 0.25, moverChance: 0.35, name: '地狱难度', spacing: 0.5, speed: 0.4, spinnerChance: 0.3 }
]

export const TITLES: { min: number; title: string }[] = [
  { min: 2000, title: '鸟中之王' },
  { min: 1000, title: '战斗猛禽' },
  { min: 500, title: '铁翅膀' },
  { min: 200, title: '能飞了' },
  { min: 0, title: '刚出壳' }
]
