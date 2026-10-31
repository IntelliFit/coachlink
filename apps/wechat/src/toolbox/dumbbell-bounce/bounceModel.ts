/**
 * 哑铃弹弹：小哑铃从随机位置、随机姿态被松手，在小重力下慢悠悠地飞向一块杠铃片，
 * 撞一下计 1 次、弹向对面那块，撞够本局次数后不再弹回去，从两片中间的缝掉出画面。
 *
 * 这是“导演过的物理”：飞行是真实的抛物线，碰撞是真实的几何接触，但每次回弹都瞄准
 * 对面片子，本局撞几下在松手时按长尾分布抽好。纯物理做不到既慢又长：两片间距大、
 * 重力小的时候，纯物理模拟中位只有 2-6 下、最多约 50 下（2026-10-31 离线实测）。
 *
 * 节奏对齐用户给的原视频：前 5 秒约每秒 1 下，哑铃基本保持横向，撞到片子时片子会被
 * 撞得转动。坐标系固定为宽 1、高 16/9 的“世界”，实时画布和录制画布只是不同缩放，
 * 所以同一局在屏幕上和视频里的轨迹完全一致。这个文件不依赖 Taro，可单测。
 */

export type BounceStatus = 'idle' | 'countdown' | 'bouncing' | 'result'

export type BounceSpeed = 1 | 2 | 3 | 5 | 10

/** 长局可能撞上千下，给到 10 倍快进。 */
export const BOUNCE_SPEEDS: BounceSpeed[] = [1, 2, 3, 5, 10]

export const COUNTDOWN_MS = 3000
/** 本局次数上限。 */
export const MAX_HITS = 9999

export const WORLD_WIDTH = 1
export const WORLD_HEIGHT = 16 / 9

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

export type PlateSide = 'left' | 'right'

export type Plate = {
  side: PlateSide
  x: number
  y: number
  radius: number
}

const PLATE_RADIUS = 0.42
/** 两片之间最窄处的缝，比哑铃长度宽，收尾时哑铃怎么转都能掉下去。 */
const THROAT_GAP = 0.36
const PLATE_Y = WORLD_HEIGHT * 0.6
const INNER_EDGE = (WORLD_WIDTH - THROAT_GAP) / 2

export const PLATES: Plate[] = [
  { side: 'left', x: INNER_EDGE - PLATE_RADIUS, y: PLATE_Y, radius: PLATE_RADIUS },
  { side: 'right', x: WORLD_WIDTH - INNER_EDGE + PLATE_RADIUS, y: PLATE_Y, radius: PLATE_RADIUS }
]

/** 哑铃外形（世界单位）。碰撞体是一根两端圆头的胶囊。 */
export const DUMBBELL_LENGTH = 0.22
export const DUMBBELL_HEIGHT = 0.125
const CAPSULE_RADIUS = DUMBBELL_HEIGHT * 0.45
const CAPSULE_HALF_SEGMENT = DUMBBELL_LENGTH / 2 - CAPSULE_RADIUS

const GRAVITY = 0.5
const STEP_SECONDS = 1 / 240
const ESCAPE_MARGIN = 0.25

/** 每次飞向对面的速度（世界宽度/秒），约每秒撞 1 下。 */
const FLIGHT_SPEED_MIN = 0.45
const FLIGHT_SPEED_MAX = 0.62
/** 落点在对面片子上半部分，从圆心看的仰角范围（度），哑铃基本是在片子肩上来回。 */
const CONTACT_ANGLE_MIN = 25
const CONTACT_ANGLE_MAX = 70
/** 哑铃到达对面时的倾斜范围（弧度），保持基本横向。 */
const MAX_ARRIVAL_TILT = 0.35

const PLATE_KICK_MIN = 0.8
const PLATE_KICK_MAX = 1.8
/** 片子被撞后转速衰减的时间常数（秒）。 */
const PLATE_SPIN_DECAY_SECONDS = 1.1

/** 收尾：撞完最后一下往缝的方向飘过去、掉下去。 */
const FALL_SPEED_MIN = 0.28
const FALL_SPEED_MAX = 0.4
const FALL_RESTITUTION = 0.4

/**
 * 本局次数的对数正态分布（中位 30 下）：约 23% 不到 10 下，56% 10-99 下，
 * 20% 100-999 下，1% 上千。改这两个数就能调整一局大概多长。
 */
const TARGET_HITS_MEDIAN = 30
const TARGET_HITS_LOG_SIGMA = 1.5

export type DumbbellBody = {
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  spin: number
}

export type BounceSim = {
  body: DumbbellBody
  ended: boolean
  /** 已经撞够次数，正在往下掉；掉落中碰到片子不再计数。 */
  falling: boolean
  hits: number
  /** 每块片子上一次计数时的模拟时间（秒），用来画撞击闪光和震动。 */
  lastHitAt: Record<PlateSide, number>
  /** 累积的未消化时间，保证固定步长。 */
  pending: number
  plateAngle: Record<PlateSide, number>
  plateSpin: Record<PlateSide, number>
  randomState: number
  targetHits: number
  time: number
}

/** 可注入的随机数，单测用固定种子复现同一局。 */
export type RandomSource = () => number

export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(random: RandomSource, min: number, max: number) {
  return min + (max - min) * random()
}

function plateOn(side: PlateSide) {
  return side === 'left' ? PLATES[0] : PLATES[1]
}

function otherSide(side: PlateSide): PlateSide {
  return side === 'left' ? 'right' : 'left'
}

/** 哑铃两端对称，转半圈算同一姿态，取最短的转动方向。 */
function shortestTurn(from: number, to: number) {
  const turn = (to - from) % Math.PI
  if (turn > Math.PI / 2) return turn - Math.PI
  if (turn < -Math.PI / 2) return turn + Math.PI
  return turn
}

/** 算一条真实抛物线：在重力下从当前位置飞到目标片子肩上的随机一点。 */
function launchToward(body: DumbbellBody, side: PlateSide, random: RandomSource): DumbbellBody {
  const plate = plateOn(side)
  const elevation = (between(random, CONTACT_ANGLE_MIN, CONTACT_ANGLE_MAX) * Math.PI) / 180
  const reach = plate.radius + CAPSULE_RADIUS
  const direction = side === 'left' ? 1 : -1
  const targetX = plate.x + direction * reach * Math.cos(elevation)
  const targetY = plate.y - reach * Math.sin(elevation)
  const distance = Math.hypot(targetX - body.x, targetY - body.y)
  const seconds = distance / between(random, FLIGHT_SPEED_MIN, FLIGHT_SPEED_MAX)
  const arrivalTilt = between(random, -MAX_ARRIVAL_TILT, MAX_ARRIVAL_TILT)
  return {
    ...body,
    spin: shortestTurn(body.angle, arrivalTilt) / seconds,
    vx: (targetX - body.x) / seconds,
    vy: (targetY - body.y) / seconds - 0.5 * GRAVITY * seconds
  }
}

/** 撞完最后一下：不再瞄准对面，朝缝的方向飘出去，打着转掉下去。 */
function launchToFall(body: DumbbellBody, side: PlateSide, random: RandomSource): DumbbellBody {
  const direction = side === 'left' ? 1 : -1
  return {
    ...body,
    spin: between(random, 2, 4) * direction,
    vx: direction * between(random, FALL_SPEED_MIN, FALL_SPEED_MAX),
    vy: between(random, -0.08, 0)
  }
}

/** 抽本局撞几下：对数正态，大多几十下，少数上百，偶尔上千。 */
export function rollTargetHits(random: RandomSource = Math.random) {
  const u = Math.max(1e-9, random())
  const v = random()
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  const hits = Math.round(TARGET_HITS_MEDIAN * Math.exp(TARGET_HITS_LOG_SIGMA * normal))
  return Math.min(MAX_HITS, Math.max(1, hits))
}

export function createSim(body: DumbbellBody, targetHits: number, seed = 1): BounceSim {
  return {
    body: { ...body },
    ended: false,
    falling: false,
    hits: 0,
    lastHitAt: { left: -Infinity, right: -Infinity },
    pending: 0,
    plateAngle: { left: 0, right: 0 },
    plateSpin: { left: 0, right: 0 },
    randomState: seed >>> 0,
    targetHits,
    time: 0
  }
}

/** 新开一局：随机位置、随机姿态松手，先慢慢飞向随机一块片子。 */
export function createRound(random: RandomSource = Math.random, targetHits = rollTargetHits(random)): BounceSim {
  const held: DumbbellBody = {
    angle: between(random, 0, Math.PI * 2),
    spin: 0,
    vx: 0,
    vy: 0,
    x: between(random, 0.3, 0.7),
    y: between(random, WORLD_HEIGHT * 0.3, WORLD_HEIGHT * 0.38)
  }
  const side: PlateSide = random() < 0.5 ? 'left' : 'right'
  const seed = Math.floor(random() * 4294967296)
  return createSim(launchToward(held, side, random), targetHits, seed)
}

function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0
  return { x: ax + dx * t, y: ay + dy * t }
}

/** 胶囊 vs 圆：有重叠且正在靠近才算接触，返回分离量和法向。 */
function contactWith(body: DumbbellBody, plate: Plate) {
  const cos = Math.cos(body.angle)
  const sin = Math.sin(body.angle)
  const closest = closestPointOnSegment(
    plate.x,
    plate.y,
    body.x - cos * CAPSULE_HALF_SEGMENT,
    body.y - sin * CAPSULE_HALF_SEGMENT,
    body.x + cos * CAPSULE_HALF_SEGMENT,
    body.y + sin * CAPSULE_HALF_SEGMENT
  )
  const offsetX = closest.x - plate.x
  const offsetY = closest.y - plate.y
  const distance = Math.hypot(offsetX, offsetY)
  const penetration = plate.radius + CAPSULE_RADIUS - distance
  if (penetration <= 0 || distance === 0) return null
  const nx = offsetX / distance
  const ny = offsetY / distance
  if (body.vx * nx + body.vy * ny >= 0) return null
  return { nx, ny, penetration }
}

function hasEscaped(body: DumbbellBody) {
  return body.y > WORLD_HEIGHT + ESCAPE_MARGIN
    || body.x < -ESCAPE_MARGIN
    || body.x > WORLD_WIDTH + ESCAPE_MARGIN
}

function step(sim: BounceSim): BounceSim {
  const dt = STEP_SECONDS
  const time = sim.time + dt
  const vy = sim.body.vy + GRAVITY * dt
  let body: DumbbellBody = {
    ...sim.body,
    angle: sim.body.angle + sim.body.spin * dt,
    vy,
    x: sim.body.x + sim.body.vx * dt,
    y: sim.body.y + vy * dt
  }
  let { falling, hits, lastHitAt, randomState } = sim
  const decay = Math.exp(-dt / PLATE_SPIN_DECAY_SECONDS)
  const plateAngle = {
    left: sim.plateAngle.left + sim.plateSpin.left * dt,
    right: sim.plateAngle.right + sim.plateSpin.right * dt
  }
  let plateSpin = { left: sim.plateSpin.left * decay, right: sim.plateSpin.right * decay }

  PLATES.forEach((plate) => {
    const contact = contactWith(body, plate)
    if (!contact) return
    const separated: DumbbellBody = {
      ...body,
      x: body.x + contact.nx * contact.penetration,
      y: body.y + contact.ny * contact.penetration
    }
    if (falling) {
      const normalSpeed = body.vx * contact.nx + body.vy * contact.ny
      body = {
        ...separated,
        vx: body.vx - (1 + FALL_RESTITUTION) * normalSpeed * contact.nx,
        vy: body.vy - (1 + FALL_RESTITUTION) * normalSpeed * contact.ny
      }
      return
    }

    // 每次碰撞用独立的随机流，保证同一局不受帧率和倍速影响。
    const random = seededRandom(randomState)
    randomState = (randomState + 0x9e3779b1) >>> 0
    // 片子被哑铃蹭得转起来：转向取决于哑铃沿片子表面滑过的方向。
    const slide = body.vx * -contact.ny + body.vy * contact.nx
    const kick = between(random, PLATE_KICK_MIN, PLATE_KICK_MAX) * (slide >= 0 ? 1 : -1)
    plateSpin = { ...plateSpin, [plate.side]: plateSpin[plate.side] + kick }
    hits += 1
    lastHitAt = { ...lastHitAt, [plate.side]: time }
    if (hits >= sim.targetHits) {
      falling = true
      body = launchToFall(separated, plate.side, random)
    } else {
      body = launchToward(separated, otherSide(plate.side), random)
    }
  })

  return {
    ...sim,
    body,
    ended: hasEscaped(body),
    falling,
    hits,
    lastHitAt,
    plateAngle,
    plateSpin,
    randomState,
    time
  }
}

/** 推进一段真实时间；speed 只是把世界时间按倍数加快，轨迹和次数不变。 */
export function advanceSim(sim: BounceSim, deltaMs: number, speed: BounceSpeed = 1): BounceSim {
  if (sim.ended) return sim
  let next: BounceSim = { ...sim, pending: sim.pending + (Math.max(0, deltaMs) / 1000) * speed }
  while (next.pending >= STEP_SECONDS && !next.ended) {
    next = { ...step(next), pending: next.pending - STEP_SECONDS }
  }
  return next
}

/** 一口气跑完一局，返回撞片次数和用时（单测、调参用）。 */
export function runToEnd(start: BounceSim) {
  let sim = start
  while (!sim.ended) {
    sim = advanceSim(sim, 1000)
  }
  return { hits: sim.hits, seconds: sim.time }
}

const JOLT_SECONDS = 0.28
const JOLT_DAMPING_SECONDS = 0.08
const JOLT_FREQUENCY = 13
/** 原视频里撞击时脸部最多顿约 8 像素（画面宽 580），约 1.4% 画面宽。 */
const JOLT_AMPLITUDE = 0.014

/** 撞击带来的画面震动（世界单位）：朝被撞的反方向猛顿一下，很快衰减。 */
export function joltOffset(sinceHit: Record<PlateSide, number>) {
  const fromLeft = sinceHit.left <= sinceHit.right
  const seconds = fromLeft ? sinceHit.left : sinceHit.right
  if (seconds < 0 || seconds >= JOLT_SECONDS) return { x: 0, y: 0 }
  const envelope = JOLT_AMPLITUDE * Math.exp(-seconds / JOLT_DAMPING_SECONDS)
  const phase = 2 * Math.PI * JOLT_FREQUENCY * seconds
  return {
    x: (fromLeft ? 1 : -1) * envelope * Math.cos(phase),
    y: envelope * 0.5 * Math.sin(phase)
  }
}

/** 画面需要的全部状态；实时画布和合成录制都只看这一份快照。 */
export type BounceScene = {
  body: Pick<DumbbellBody, 'angle' | 'x' | 'y'>
  countdownMs: number
  exerciseLabel: string
  hits: number
  plateAngle: Record<PlateSide, number>
  /** 距离左右片子上一次撞击过去的秒数，用于闪光、数字放大和画面震动。 */
  sinceHit: Record<PlateSide, number>
  resultAgeMs: number
  status: BounceStatus
}

export function sceneFromSim(
  sim: BounceSim,
  base: Pick<BounceScene, 'countdownMs' | 'exerciseLabel' | 'resultAgeMs' | 'status'>
): BounceScene {
  return {
    ...base,
    body: { angle: sim.body.angle, x: sim.body.x, y: sim.body.y },
    hits: sim.hits,
    plateAngle: { ...sim.plateAngle },
    sinceHit: {
      left: sim.time - sim.lastHitAt.left,
      right: sim.time - sim.lastHitAt.right
    }
  }
}

/** 目标次数：倒计时结束前还没开始弹，不显示数字。 */
export function repsFromScene(scene: Pick<BounceScene, 'hits' | 'status'>) {
  if (scene.status === 'idle' || scene.status === 'countdown') return null
  return scene.hits
}
