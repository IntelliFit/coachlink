/**
 * 哑铃弹弹：小哑铃从随机位置、随机姿态被松手，在重力下落进左右两块
 * 圆形杠铃片之间来回弹，每撞一次片子计 1 次，自己掉出画面就结束。
 *
 * 运动是一个 2D 刚体模拟（胶囊形哑铃 vs 圆形片子，冲量法碰撞 + 摩擦），
 * 坐标系固定为宽 1、高 16/9 的“世界”，实时画布和录制画布只是不同缩放，
 * 所以同一局在屏幕上和视频里的轨迹完全一致。这个文件不依赖 Taro，可单测。
 */

export type BounceStatus = 'idle' | 'countdown' | 'bouncing' | 'result'

export type BounceSpeed = 1 | 2 | 3

export const BOUNCE_SPEEDS: BounceSpeed[] = [1, 2, 3]

export const COUNTDOWN_MS = 3000
/** 兜底：无论如何一局最多模拟这么久（世界时间）。 */
export const MAX_SIM_MS = 60000

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

export type Plate = {
  side: 'left' | 'right'
  x: number
  y: number
  radius: number
}

/** 两片之间最窄处（片子圆心高度）的缝隙，略大于哑铃长度：横着能掉下去，但要先在漏斗里弹一阵。 */
export type PlateGeometry = {
  plateRadius: number
  throatGap: number
}

// 2026-10-25 离线调参（2000 次随机松手）：中位 4 下、P90 8 下、最多 20 下，
// 约 8% 直接掉穿（0 下），一局约 1.3 秒（世界时间），没有卡住的情况。
export const DEFAULT_GEOMETRY: PlateGeometry = {
  plateRadius: 0.5,
  throatGap: 0.28
}

const PLATE_Y = WORLD_HEIGHT * 0.6

export function platesFor(geometry: PlateGeometry): Plate[] {
  const innerEdge = (WORLD_WIDTH - geometry.throatGap) / 2
  return [
    { side: 'left', x: innerEdge - geometry.plateRadius, y: PLATE_Y, radius: geometry.plateRadius },
    { side: 'right', x: WORLD_WIDTH - innerEdge + geometry.plateRadius, y: PLATE_Y, radius: geometry.plateRadius }
  ]
}

export const PLATES: Plate[] = platesFor(DEFAULT_GEOMETRY)

/** 哑铃外形（世界单位）。碰撞体是一根两端圆头的胶囊。 */
export const DUMBBELL_LENGTH = 0.26
export const DUMBBELL_HEIGHT = 0.15
const CAPSULE_RADIUS = DUMBBELL_HEIGHT * 0.45
const CAPSULE_HALF_SEGMENT = DUMBBELL_LENGTH / 2 - CAPSULE_RADIUS

export type PhysicsTuning = {
  plates: Plate[]
  gravity: number
  restitution: number
  friction: number
}

export const DEFAULT_TUNING: PhysicsTuning = {
  plates: PLATES,
  gravity: 6,
  // 包胶哑铃撞包胶片，回弹偏高；摩擦让它撞完会带出转动。
  restitution: 0.88,
  friction: 0.18
}

const MASS = 1
const INERTIA = MASS * (DUMBBELL_LENGTH * DUMBBELL_LENGTH / 12 + CAPSULE_RADIUS * CAPSULE_RADIUS / 2)
const STEP_SECONDS = 1 / 240
/** 碰撞法向速度低于这个值不算“撞一下”（贴着滚动、静止压着都不计数）。 */
const MIN_HIT_SPEED = 0.25
/** 同一块片子两次计数之间至少分开这么久，防止一次撞击里的抖动被重复计数。 */
const HIT_COOLDOWN_SECONDS = 0.08
/** 速度一直很小超过这个时长，认为卡在两片之间，结束本局。 */
const STUCK_SECONDS = 1.2
const STUCK_SPEED = 0.06
const ESCAPE_MARGIN = 0.25

export type DumbbellBody = {
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  spin: number
}

export type BounceEnd = 'fell' | 'stuck' | 'timeout'

export type BounceSim = {
  body: DumbbellBody
  ended: BounceEnd | null
  hits: number
  /** 每块片子上一次计数时的模拟时间（秒），用来画撞击闪光。 */
  lastHitAt: Record<Plate['side'], number>
  stillFor: number
  time: number
  /** 累积的未消化时间，保证固定步长。 */
  pending: number
}

/** 可注入的随机数，单测和调参脚本用固定种子复现同一局。 */
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

/** 随机松手：位置在两片上方，姿态、初速度（可能先往上抛）和自转都随机。 */
export function createRelease(random: RandomSource = Math.random): DumbbellBody {
  return {
    angle: between(random, 0, Math.PI * 2),
    spin: between(random, -7, 7),
    vx: between(random, -0.6, 0.6),
    vy: between(random, -1, 0),
    x: between(random, 0.18, 0.82),
    y: between(random, WORLD_HEIGHT * 0.18, WORLD_HEIGHT * 0.3)
  }
}

export function createSim(body: DumbbellBody): BounceSim {
  return {
    body: { ...body },
    ended: null,
    hits: 0,
    lastHitAt: { left: -Infinity, right: -Infinity },
    pending: 0,
    stillFor: 0,
    time: 0
  }
}

function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0
  return { x: ax + dx * t, y: ay + dy * t }
}

type Contact = {
  hit: boolean
  body: DumbbellBody
}

/** 胶囊 vs 圆的碰撞：分离 + 法向冲量（带回弹）+ 库仑摩擦冲量。 */
function resolvePlate(body: DumbbellBody, plate: Plate, tuning: PhysicsTuning): Contact {
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
  const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
  const penetration = plate.radius + CAPSULE_RADIUS - distance
  if (penetration <= 0 || distance === 0) return { body, hit: false }

  const nx = offsetX / distance
  const ny = offsetY / distance
  // 接触点在胶囊表面朝向片子的那一侧。
  const rx = closest.x - nx * CAPSULE_RADIUS - body.x
  const ry = closest.y - ny * CAPSULE_RADIUS - body.y

  let { vx, vy, spin } = body
  const relVx = vx - spin * ry
  const relVy = vy + spin * rx
  const normalSpeed = relVx * nx + relVy * ny
  let hit = false

  if (normalSpeed < 0) {
    const rCrossN = rx * ny - ry * nx
    const normalImpulse = (-(1 + tuning.restitution) * normalSpeed) / (1 / MASS + (rCrossN * rCrossN) / INERTIA)
    vx += (normalImpulse * nx) / MASS
    vy += (normalImpulse * ny) / MASS
    spin += (rCrossN * normalImpulse) / INERTIA

    const tx = -ny
    const ty = nx
    const tangentSpeed = (vx - spin * ry) * tx + (vy + spin * rx) * ty
    const rCrossT = rx * ty - ry * tx
    const rawTangentImpulse = -tangentSpeed / (1 / MASS + (rCrossT * rCrossT) / INERTIA)
    const maxTangentImpulse = tuning.friction * normalImpulse
    const tangentImpulse = Math.max(-maxTangentImpulse, Math.min(maxTangentImpulse, rawTangentImpulse))
    vx += (tangentImpulse * tx) / MASS
    vy += (tangentImpulse * ty) / MASS
    spin += (rCrossT * tangentImpulse) / INERTIA

    hit = -normalSpeed >= MIN_HIT_SPEED
  }

  return {
    body: {
      ...body,
      spin,
      vx,
      vy,
      x: body.x + nx * penetration,
      y: body.y + ny * penetration
    },
    hit
  }
}

function hasEscaped(body: DumbbellBody) {
  return body.y > WORLD_HEIGHT + ESCAPE_MARGIN
    || body.x < -ESCAPE_MARGIN
    || body.x > WORLD_WIDTH + ESCAPE_MARGIN
}

function step(sim: BounceSim, tuning: PhysicsTuning): BounceSim {
  const dt = STEP_SECONDS
  const time = sim.time + dt
  let body: DumbbellBody = {
    ...sim.body,
    angle: sim.body.angle + sim.body.spin * dt,
    vy: sim.body.vy + tuning.gravity * dt,
    x: sim.body.x + sim.body.vx * dt,
    y: sim.body.y + (sim.body.vy + tuning.gravity * dt) * dt
  }
  let hits = sim.hits
  let lastHitAt = sim.lastHitAt

  tuning.plates.forEach((plate) => {
    const contact = resolvePlate(body, plate, tuning)
    body = contact.body
    if (contact.hit && time - lastHitAt[plate.side] >= HIT_COOLDOWN_SECONDS) {
      hits += 1
      lastHitAt = { ...lastHitAt, [plate.side]: time }
    }
  })

  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
  const stillFor = speed < STUCK_SPEED && Math.abs(body.spin) < 0.5 ? sim.stillFor + dt : 0
  const ended: BounceEnd | null = hasEscaped(body)
    ? 'fell'
    : stillFor >= STUCK_SECONDS
      ? 'stuck'
      : time * 1000 >= MAX_SIM_MS
        ? 'timeout'
        : null

  return { ...sim, body, ended, hits, lastHitAt, stillFor, time }
}

/** 推进一段真实时间；speed 只是把世界时间按倍数加快，物理本身不变。 */
export function advanceSim(
  sim: BounceSim,
  deltaMs: number,
  speed: BounceSpeed = 1,
  tuning: PhysicsTuning = DEFAULT_TUNING
): BounceSim {
  if (sim.ended) return sim
  let next: BounceSim = { ...sim, pending: sim.pending + (Math.max(0, deltaMs) / 1000) * speed }
  while (next.pending >= STEP_SECONDS && !next.ended) {
    next = { ...step(next, tuning), pending: next.pending - STEP_SECONDS }
  }
  return next
}

/** 一口气跑完一局，返回撞片次数和结束方式（单测、调参用）。 */
export function simulateRound(body: DumbbellBody, tuning: PhysicsTuning = DEFAULT_TUNING) {
  let sim = createSim(body)
  while (!sim.ended) {
    sim = advanceSim(sim, 1000, 1, tuning)
  }
  return { ended: sim.ended, hits: sim.hits, seconds: sim.time }
}

/** 画面需要的全部状态；实时画布和合成录制都只看这一份快照。 */
export type BounceScene = {
  body: Pick<DumbbellBody, 'angle' | 'x' | 'y'>
  countdownMs: number
  exerciseLabel: string
  hits: number
  /** 距离左右片子上一次撞击过去的秒数，用于闪光和数字放大。 */
  sinceHit: Record<Plate['side'], number>
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
