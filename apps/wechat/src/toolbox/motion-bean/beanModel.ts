/**
 * 接豆派对的纯逻辑：脸就是接豆的嘴，豆子碰到脸就算吃到。页面每帧调 advanceBeanGame，
 * 实时画布和录制画布都只读这份状态。不依赖小程序 API。
 *
 * 坐标：x 以画面宽为 1，y 以画面高为 1；算距离时用 aspect（高/宽）换算成宽度单位。
 */

export type BeanStatus = 'idle' | 'countdown' | 'playing' | 'result'

export type BeanKind = 'bad' | 'gold' | 'good'

export type BeanEventType =
  | 'bad'
  | 'catch'
  | 'comboUp'
  | 'countdownTick'
  | 'gameOver'
  | 'go'
  | 'gold'
  | 'sprint'

export type BeanEvent = { type: BeanEventType; value?: number }

export type Bean = {
  id: number
  kind: BeanKind
  rotation: number
  spin: number
  vx: number
  vy: number
  x: number
  y: number
}

export type BeanFx = {
  color: string
  id: number
  kind: 'ring' | 'text'
  lifeMs: number
  maxLifeMs: number
  size: number
  text?: string
  x: number
  y: number
}

export type BeanFace = { radiusX: number; x: number; y: number }

export type BeanBanner = { ageMs: number; sub: string; text: string }

export type BeanGame = {
  aspect: number
  badHits: number
  banner: BeanBanner | null
  beans: Bean[]
  bestCombo: number
  caught: number
  combo: number
  elapsedMs: number
  face: BeanFace | null
  flashMs: number
  fx: BeanFx[]
  goMs: number
  golds: number
  lastSpawnX: number
  nextId: number
  paused: boolean
  rng: number
  score: number
  scorePopMs: number
  spawnInMs: number
  sprintAnnounced: boolean
  status: BeanStatus
  statusMs: number
  tracking: boolean
}

export type BeanInput = { face: BeanFace | null; tracking: boolean }

export type BeanStep = { events: BeanEvent[]; game: BeanGame }

export const BEAN_COUNTDOWN_MS = 5000
export const BEAN_ROUND_MS = 45000
export const BEAN_SPRINT_MS = 10000
export const BEAN_GO_MS = 700
export const BEAN_BANNER_MS = 1400
export const GOOD_SCORE = 1
export const GOLD_SCORE = 5
export const BAD_PENALTY = 3
export const COMBO_FOR_DOUBLE = 5
export const COMBO_FOR_TRIPLE = 15
export const BEAN_RADIUS: Record<BeanKind, number> = { bad: 0.056, gold: 0.066, good: 0.05 }

const MAX_STEP_MS = 64
const FACE_FOLLOW_TAU_MS = 50
const MIN_FACE_RADIUS = 0.08
const MAX_FACE_RADIUS = 0.18
const SPAWN_MIN_X = 0.12
const SPAWN_MAX_X = 0.88
const MIN_SPAWN_GAP_X = 0.14
const SPAWN_Y = -0.06
const FLASH_MS = 300
const MAX_FX = 40
const GOLD_CHANCE = 0.07
const TITLES: { min: number; title: string }[] = [
  { min: 450, title: '豆神' },
  { min: 280, title: '接豆高手' },
  { min: 150, title: '接豆能手' },
  { min: 60, title: '开始上头' },
  { min: 0, title: '豆子新手' }
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let mixed = state
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    },
    state: () => state
  }
}

type StepContext = {
  dt: number
  events: BeanEvent[]
  game: BeanGame
  input: BeanInput
  random: ReturnType<typeof createRandom>
}

export function beanTitle(score: number) {
  return (TITLES.find((item) => score >= item.min) || TITLES[TITLES.length - 1]).title
}

export function comboMultiplier(combo: number) {
  if (combo >= COMBO_FOR_TRIPLE) return 3
  return combo >= COMBO_FOR_DOUBLE ? 2 : 1
}

export function inSprint(game: Pick<BeanGame, 'elapsedMs'>) {
  return game.elapsedMs >= BEAN_ROUND_MS - BEAN_SPRINT_MS
}

export function timeLeftMs(game: Pick<BeanGame, 'elapsedMs'>) {
  return Math.max(0, BEAN_ROUND_MS - game.elapsedMs)
}

/** 难度随时间线性变难，最后 10 秒再上一个台阶。 */
export function difficultyAt(elapsedMs: number) {
  const progress = clamp(elapsedMs / (BEAN_ROUND_MS - BEAN_SPRINT_MS), 0, 1)
  if (elapsedMs >= BEAN_ROUND_MS - BEAN_SPRINT_MS) {
    return { badChance: 0.26, fallSpeed: 0.52, spawnEveryMs: 220 }
  }
  return {
    badChance: lerp(0.14, 0.24, progress),
    fallSpeed: lerp(0.28, 0.42, progress),
    spawnEveryMs: lerp(520, 300, progress)
  }
}

export function beanTouchesFace(bean: Bean, face: BeanFace, aspect: number) {
  const faceRadius = clamp(face.radiusX, MIN_FACE_RADIUS, MAX_FACE_RADIUS)
  // 坏豆判定收紧一点：擦边不算吃到，躲开时才不会觉得冤。
  const reach = bean.kind === 'bad'
    ? faceRadius * 0.8 + BEAN_RADIUS.bad * 0.5
    : faceRadius + BEAN_RADIUS[bean.kind] * 0.8
  return Math.hypot(bean.x - face.x, (bean.y - face.y) * aspect) < reach
}

export function createBeanGame(options: { aspect?: number; seed?: number } = {}): BeanGame {
  return {
    aspect: options.aspect && options.aspect > 0 ? options.aspect : 16 / 9,
    badHits: 0,
    banner: null,
    beans: [],
    bestCombo: 0,
    caught: 0,
    combo: 0,
    elapsedMs: 0,
    face: null,
    flashMs: 0,
    fx: [],
    goMs: 0,
    golds: 0,
    lastSpawnX: 0.5,
    nextId: 1,
    paused: false,
    rng: options.seed ?? 1,
    score: 0,
    scorePopMs: 0,
    spawnInMs: 0,
    sprintAnnounced: false,
    status: 'idle',
    statusMs: 0,
    tracking: false
  }
}

export function startBeanCountdown(game: BeanGame, seed: number): BeanGame {
  return {
    ...createBeanGame({ aspect: game.aspect, seed }),
    face: game.face,
    status: 'countdown',
    tracking: game.tracking
  }
}

export function cancelBeanToIdle(game: BeanGame): BeanGame {
  return { ...createBeanGame({ aspect: game.aspect, seed: game.rng }), face: game.face, tracking: game.tracking }
}

/** 玩家主动结束：直接结算，分数保留。 */
export function endBeanRun(game: BeanGame): BeanGame {
  if (game.status !== 'playing') return game
  return { ...game, beans: [], status: 'result', statusMs: 0 }
}

function pushFx(context: StepContext, item: Omit<BeanFx, 'id'>) {
  const { game } = context
  context.game = {
    ...game,
    fx: [...game.fx, { ...item, id: game.nextId }].slice(-MAX_FX),
    nextId: game.nextId + 1
  }
}

function floatText(context: StepContext, text: string, x: number, y: number, color: string) {
  pushFx(context, { color, kind: 'text', lifeMs: 700, maxLifeMs: 700, size: 0.05, text, x, y })
}

function followInput(context: StepContext) {
  const { dt, game, input } = context
  const blend = 1 - Math.exp(-dt / FACE_FOLLOW_TAU_MS)
  const face = !input.face
    ? null
    : !game.face
      ? input.face
      : {
          radiusX: game.face.radiusX + (input.face.radiusX - game.face.radiusX) * blend,
          x: game.face.x + (input.face.x - game.face.x) * blend,
          y: game.face.y + (input.face.y - game.face.y) * blend
        }
  context.game = { ...game, face, tracking: input.tracking }
}

function advanceTimers(context: StepContext) {
  const { dt, game } = context
  const banner = game.banner && game.banner.ageMs + dt < BEAN_BANNER_MS
    ? { ...game.banner, ageMs: game.banner.ageMs + dt }
    : null
  context.game = {
    ...game,
    banner,
    flashMs: Math.max(0, game.flashMs - dt),
    fx: game.fx.map((item) => ({ ...item, lifeMs: item.lifeMs - dt })).filter((item) => item.lifeMs > 0),
    goMs: Math.max(0, game.goMs - dt),
    scorePopMs: Math.max(0, game.scorePopMs - dt)
  }
}

function advanceCountdown(context: StepContext) {
  const { dt, game } = context
  const before = Math.ceil((BEAN_COUNTDOWN_MS - game.statusMs) / 1000)
  const after = Math.ceil((BEAN_COUNTDOWN_MS - game.statusMs - dt) / 1000)
  if (game.statusMs === 0) context.events.push({ type: 'countdownTick', value: before })
  else if (after !== before && after > 0) context.events.push({ type: 'countdownTick', value: after })
  if (game.statusMs + dt < BEAN_COUNTDOWN_MS) return
  context.events.push({ type: 'go' })
  context.game = { ...game, goMs: BEAN_GO_MS, status: 'playing' }
}

function chooseKind(context: StepContext, badChance: number): BeanKind {
  const roll = context.random.next()
  if (roll < GOLD_CHANCE) return 'gold'
  return roll < GOLD_CHANCE + badChance ? 'bad' : 'good'
}

/** 新豆子和上一颗拉开距离，避免连着落在同一条线上，人得左右动起来。 */
function chooseSpawnX(context: StepContext) {
  const { game, random } = context
  const x = SPAWN_MIN_X + random.next() * (SPAWN_MAX_X - SPAWN_MIN_X)
  if (Math.abs(x - game.lastSpawnX) >= MIN_SPAWN_GAP_X) return x
  const shifted = x + (x < game.lastSpawnX ? -MIN_SPAWN_GAP_X : MIN_SPAWN_GAP_X)
  return shifted < SPAWN_MIN_X || shifted > SPAWN_MAX_X ? 1 - x : shifted
}

function spawnBean(context: StepContext) {
  const { game, random } = context
  const level = difficultyAt(game.elapsedMs)
  const kind = chooseKind(context, level.badChance)
  const x = chooseSpawnX(context)
  const bean: Bean = {
    id: game.nextId,
    kind,
    rotation: random.next() * Math.PI * 2,
    spin: (random.next() - 0.5) * 3,
    vx: (random.next() - 0.5) * 0.05,
    vy: level.fallSpeed * (kind === 'gold' ? 1.15 : 0.9 + random.next() * 0.2),
    x,
    y: SPAWN_Y
  }
  context.game = {
    ...game,
    beans: [...game.beans, bean],
    lastSpawnX: x,
    nextId: game.nextId + 1,
    spawnInMs: level.spawnEveryMs
  }
}

function moveBeans(context: StepContext) {
  const { dt, game } = context
  const seconds = dt / 1000
  context.game = {
    ...game,
    beans: game.beans
      .map((bean) => ({
        ...bean,
        rotation: bean.rotation + bean.spin * seconds,
        x: bean.x + bean.vx * seconds,
        y: bean.y + bean.vy * seconds
      }))
      .filter((bean) => bean.y < 1.08),
    spawnInMs: game.spawnInMs - dt
  }
  if (context.game.spawnInMs <= 0) spawnBean(context)
}

function catchBean(context: StepContext, bean: Bean) {
  const { game } = context
  const value = bean.kind === 'gold' ? GOLD_SCORE : GOOD_SCORE
  const combo = game.combo + 1
  const multiplier = comboMultiplier(combo)
  context.events.push({ type: bean.kind === 'gold' ? 'gold' : 'catch', value: combo })
  context.game = {
    ...game,
    bestCombo: Math.max(game.bestCombo, combo),
    caught: game.caught + 1,
    combo,
    golds: game.golds + (bean.kind === 'gold' ? 1 : 0),
    score: game.score + value * multiplier,
    scorePopMs: 220
  }
  pushFx(context, {
    color: bean.kind === 'gold' ? '#ffc629' : '#ffffff',
    kind: 'ring',
    lifeMs: 320,
    maxLifeMs: 320,
    size: bean.kind === 'gold' ? 0.14 : 0.09,
    x: bean.x,
    y: bean.y
  })
  if (bean.kind === 'gold') floatText(context, `+${value * multiplier}`, bean.x, bean.y - 0.04, '#ffc629')
  if (multiplier > comboMultiplier(game.combo)) {
    context.events.push({ type: 'comboUp', value: multiplier })
    floatText(context, `×${multiplier}`, bean.x, bean.y - 0.04, '#ffffff')
  }
}

function hitBadBean(context: StepContext, bean: Bean) {
  const { game } = context
  context.events.push({ type: 'bad' })
  context.game = {
    ...game,
    badHits: game.badHits + 1,
    combo: 0,
    flashMs: FLASH_MS,
    score: Math.max(0, game.score - BAD_PENALTY)
  }
  floatText(context, `-${BAD_PENALTY}`, bean.x, bean.y - 0.04, '#ffffff')
}

function resolveCatches(context: StepContext) {
  const { game } = context
  const face = game.face
  if (!face) return
  const touched = game.beans.filter((bean) => beanTouchesFace(bean, face, game.aspect))
  if (!touched.length) return
  const touchedIds = new Set(touched.map((bean) => bean.id))
  context.game = { ...game, beans: game.beans.filter((bean) => !touchedIds.has(bean.id)) }
  touched.forEach((bean) => {
    if (bean.kind === 'bad') hitBadBean(context, bean)
    else catchBean(context, bean)
  })
}

function advancePlaying(context: StepContext) {
  const { dt, input } = context
  if (!input.tracking) {
    context.game = { ...context.game, paused: true }
    return
  }
  context.game = { ...context.game, elapsedMs: context.game.elapsedMs + dt, paused: false }
  moveBeans(context)
  resolveCatches(context)

  const { game } = context
  if (inSprint(game) && !game.sprintAnnounced) {
    context.events.push({ type: 'sprint' })
    context.game = {
      ...game,
      banner: { ageMs: 0, sub: '豆子变多了', text: '最后 10 秒' },
      sprintAnnounced: true
    }
  }
  if (context.game.elapsedMs >= BEAN_ROUND_MS) {
    context.events.push({ type: 'gameOver' })
    context.game = { ...context.game, beans: [], elapsedMs: BEAN_ROUND_MS, status: 'result' }
  }
}

export function advanceBeanGame(game: BeanGame, dtMs: number, input: BeanInput): BeanStep {
  const dt = clamp(dtMs, 0, MAX_STEP_MS)
  const random = createRandom(game.rng)
  const context: StepContext = { dt, events: [], game, input, random }

  followInput(context)
  advanceTimers(context)
  if (game.status === 'countdown') advanceCountdown(context)
  else if (game.status === 'playing') advancePlaying(context)

  const statusMs = context.game.status === game.status ? game.statusMs + dt : 0
  return { events: context.events, game: { ...context.game, rng: random.state(), statusMs } }
}
