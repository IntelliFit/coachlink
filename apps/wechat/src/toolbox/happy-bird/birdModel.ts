/**
 * 快乐小鸟的纯逻辑：不依赖小程序 API，页面每帧调 advanceGame，
 * 实时画布和录制画布都只读这份状态，所以两边画面完全一致。
 *
 * 坐标：x 以画面宽为 1，y 以画面高为 1；需要算真实距离时用 aspect（高/宽）换算成宽度单位。
 */

import {
  BIRD_HIT_RADIUS,
  BIRD_RADIUS,
  BIRD_X,
  COIN_SCORE,
  COUNTDOWN_MS,
  FEVER_COMBO_STEP,
  FEVER_MS,
  FIRST_FEVER_COMBO,
  GATE_SCORE,
  GATE_WIDTH,
  GATES_PER_LEVEL,
  LEVELS,
  MAX_LIVES,
  PERFECT_SCORE,
  REP_SCORE,
  SPINNER_THICKNESS,
  TITLES,
  WARMUP_GATES,
  type BirdGame,
  type BirdInput,
  type BirdStep,
  type FxKind,
  type GateObstacle,
  type LevelConfig,
  type Obstacle,
  type Pickup,
  type SpinnerObstacle
} from './birdTypes'

import { burst, createRandom, floatText, pushFx, ring, type StepContext } from './birdFx'

export * from './birdTypes'

const MAX_STEP_MS = 64
const BIRD_FOLLOW_TAU_MS = 60
const GO_MS = 700
const INVINCIBLE_AFTER_HIT_MS = 1500
const INVINCIBLE_AFTER_SHIELD_MS = 900
const CRASH_GRAVITY = 2.4
const CRASH_HOP = -0.75
const CRASH_MAX_MS = 1700
const SPAWN_X = 1.12
const COIN_PICK_RADIUS = 0.095
const MAGNET_RANGE = 0.5
const COINS_PER_ROUTE = 3
const PERFECT_ZONE = 0.15
const BANNER_MS = 1500
const REP_HIGH_LINE = 0.38
const REP_LOW_LINE = 0.62
const SPINNER_DODGE_OFFSET = 0.3
const MIN_SHAKER_GAP = 9
const MAX_SHAKER_GAP = 14
const FEVER_TRAIL_COLOR = '#ffc629'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function levelConfig(level: number) {
  return LEVELS[clamp(level, 1, LEVELS.length) - 1]
}

export function birdTitle(score: number) {
  return (TITLES.find((item) => score >= item.min) || TITLES[TITLES.length - 1]).title
}

export function scoreMultiplier(game: Pick<BirdGame, 'feverMs'>) {
  return game.feverMs > 0 ? 2 : 1
}

export function gateCenterNow(gate: GateObstacle) {
  if (!gate.swing) return gate.center
  const offset = Math.sin((gate.swing.phaseMs / gate.swing.periodMs) * Math.PI * 2) * gate.swing.amplitude
  return gate.center + offset
}

export function gateEdges(gate: GateObstacle) {
  const center = gateCenterNow(gate)
  return { bottom: center + gate.gapHeight / 2, top: center - gate.gapHeight / 2 }
}

export function birdHitsGate(birdY: number, gate: GateObstacle, aspect: number) {
  if (Math.abs(BIRD_X - gate.x) > gate.width / 2 + BIRD_HIT_RADIUS) return false
  const edges = gateEdges(gate)
  const radiusY = BIRD_HIT_RADIUS / aspect
  return birdY - radiusY < edges.top || birdY + radiusY > edges.bottom
}

export function birdHitsSpinner(birdY: number, spinner: SpinnerObstacle, aspect: number) {
  const dx = BIRD_X - spinner.x
  const dy = (birdY - spinner.y) * aspect
  const along = clamp(
    dx * Math.cos(spinner.angle) + dy * Math.sin(spinner.angle),
    -spinner.halfLength,
    spinner.halfLength
  )
  const nearestX = along * Math.cos(spinner.angle)
  const nearestY = along * Math.sin(spinner.angle)
  return Math.hypot(dx - nearestX, dy - nearestY) < BIRD_HIT_RADIUS + SPINNER_THICKNESS / 2
}

function obstacleHalfWidth(obstacle: Obstacle) {
  return obstacle.kind === 'gate' ? obstacle.width / 2 : obstacle.halfLength
}

export function createGame(options: { aspect?: number; seed?: number } = {}): BirdGame {
  return {
    aspect: options.aspect && options.aspect > 0 ? options.aspect : 16 / 9,
    banner: null,
    bestCombo: 0,
    bird: { flapMs: 0, rotation: 0, vy: 0, y: 0.5 },
    coins: 0,
    combo: 0,
    distanceToNext: 0,
    elapsedMs: 0,
    feverMs: 0,
    fx: [],
    gatesPassed: 0,
    gatesSpawned: 0,
    gatesUntilShaker: MIN_SHAKER_GAP,
    goMs: 0,
    hitFlashMs: 0,
    invincibleMs: 0,
    lastSide: 1,
    level: 1,
    lives: MAX_LIVES,
    nextFeverCombo: FIRST_FEVER_COMBO,
    nextId: 1,
    obstacles: [],
    paused: false,
    perfectFlashMs: 0,
    perfects: 0,
    pickups: [],
    repPhase: null,
    repTransitions: 0,
    reps: 0,
    rng: options.seed ?? 1,
    routeY: null,
    score: 0,
    scorePopMs: 0,
    shakeMs: 0,
    shield: false,
    speed: LEVELS[0].speed,
    status: 'idle',
    statusMs: 0,
    tracking: false
  }
}

/** 开新一局：保留小鸟当前高度，分数、障碍全部清零。 */
export function startCountdown(game: BirdGame, seed: number): BirdGame {
  return {
    ...createGame({ aspect: game.aspect, seed }),
    bird: game.bird,
    status: 'countdown',
    tracking: game.tracking
  }
}

export function cancelToIdle(game: BirdGame): BirdGame {
  return { ...createGame({ aspect: game.aspect, seed: game.rng }), bird: game.bird, tracking: game.tracking }
}

/** 玩家主动结束：和撞完最后一条命走同一段坠落 + 结算。 */
export function endRun(game: BirdGame): BirdGame {
  if (game.status !== 'playing') return game
  return { ...game, bird: { ...game.bird, vy: CRASH_HOP }, status: 'crashing', statusMs: 0 }
}

function addScore(context: StepContext, base: number) {
  const gained = base * scoreMultiplier(context.game)
  context.game = { ...context.game, score: context.game.score + gained, scorePopMs: 260 }
  return gained
}

function followInput(context: StepContext) {
  const { dt, game, input } = context
  const blend = 1 - Math.exp(-dt / BIRD_FOLLOW_TAU_MS)
  const target = input.targetY ?? game.bird.y
  const y = game.bird.y + (target - game.bird.y) * blend
  const instantVy = dt > 0 ? (y - game.bird.y) / (dt / 1000) : 0
  const vy = game.bird.vy + (instantVy - game.bird.vy) * 0.25
  const rotation = clamp(vy * 0.55, -0.6, 0.6)
  context.game = {
    ...game,
    bird: { flapMs: game.bird.flapMs + dt, rotation, vy, y },
    tracking: input.tracking
  }
}

function advanceFx(context: StepContext) {
  const { dt, game } = context
  const seconds = dt / 1000
  const fx = game.fx
    .map((item) => ({
      ...item,
      lifeMs: item.lifeMs - dt,
      rotation: item.rotation + item.spin * seconds,
      vy: item.vy + item.gravity * seconds,
      x: item.x + item.vx * seconds,
      y: item.y + item.vy * seconds
    }))
    .filter((item) => item.lifeMs > 0 && item.y < 1.3)
  context.game = { ...game, fx }
}

function advanceTimers(context: StepContext) {
  const { dt, game } = context
  const banner = game.banner && game.banner.ageMs + dt < BANNER_MS
    ? { ...game.banner, ageMs: game.banner.ageMs + dt }
    : null
  context.game = {
    ...game,
    banner,
    goMs: Math.max(0, game.goMs - dt),
    hitFlashMs: Math.max(0, game.hitFlashMs - dt),
    perfectFlashMs: Math.max(0, game.perfectFlashMs - dt),
    scorePopMs: Math.max(0, game.scorePopMs - dt),
    shakeMs: Math.max(0, game.shakeMs - dt)
  }
}

function advanceCountdown(context: StepContext) {
  const { dt, game } = context
  const before = Math.ceil((COUNTDOWN_MS - game.statusMs) / 1000)
  const statusMs = game.statusMs
  const after = Math.ceil((COUNTDOWN_MS - statusMs - dt) / 1000)
  if (statusMs === 0) context.events.push({ type: 'countdownTick', value: before })
  else if (after !== before && after > 0) context.events.push({ type: 'countdownTick', value: after })
  if (statusMs + dt < COUNTDOWN_MS) return
  context.events.push({ type: 'go' })
  context.game = {
    ...game,
    // “开飞”消失后再出现，两行字不打架。
    banner: { ageMs: -GO_MS, sub: `前 ${WARMUP_GATES} 道门撞了不扣命`, text: '热身开始', tone: 'level' },
    distanceToNext: 0,
    goMs: GO_MS,
    status: 'playing'
  }
}

function chooseNextSide(context: StepContext, level: number): -1 | 1 {
  const { game, random } = context
  const repeat = level >= 3 && random.next() < 0.15
  return repeat ? game.lastSide : ((game.lastSide * -1) as -1 | 1)
}

function buildGate(context: StepContext, config: LevelConfig, id: number) {
  const { game, random } = context
  const first = game.gatesSpawned === 0
  const side = first ? game.lastSide : chooseNextSide(context, game.level)
  const offset = first ? 0 : side * config.amplitude * (0.8 + random.next() * 0.2)
  const moves = random.next() < config.moverChance
  const gapHeight = first ? 0.42 : config.gapHeight
  const center = 0.5 + offset
  const gate: GateObstacle = {
    center,
    gapHeight,
    ghosted: false,
    id,
    kind: 'gate',
    passed: false,
    swing: moves
      ? { amplitude: 0.05 + random.next() * 0.03, periodMs: 2400 + random.next() * 800, phaseMs: random.next() * 2400 }
      : null,
    warmup: game.gatesSpawned < WARMUP_GATES,
    width: GATE_WIDTH,
    x: SPAWN_X
  }
  return { gate, routeY: center, side }
}

function buildSpinner(context: StepContext, id: number) {
  const { game, random } = context
  const side = (game.lastSide * -1) as -1 | 1
  const spinner: SpinnerObstacle = {
    angle: random.next() * Math.PI,
    ghosted: false,
    halfLength: 0.26,
    id,
    kind: 'spinner',
    omega: (random.next() < 0.5 ? -1 : 1) * (1.5 + random.next() * 0.6),
    passed: false,
    warmup: game.gatesSpawned < WARMUP_GATES,
    x: SPAWN_X + 0.14,
    y: 0.5
  }
  return { routeY: 0.5 + side * SPINNER_DODGE_OFFSET, side, spinner }
}

function buildCoinRoute(fromY: number | null, toY: number, spacing: number, firstId: number): Pickup[] {
  if (fromY === null) return []
  return Array.from({ length: COINS_PER_ROUTE }, (_, index) => {
    const t = (index + 1) / (COINS_PER_ROUTE + 1)
    const eased = t * t * (3 - 2 * t)
    return {
      id: firstId + index,
      kind: 'coin' as const,
      x: SPAWN_X - spacing * (1 - t),
      y: fromY + (toY - fromY) * eased
    }
  })
}

function spawnObstacle(context: StepContext, config: LevelConfig) {
  const { game, random } = context
  const useSpinner = game.gatesSpawned > 0
    && game.obstacles[game.obstacles.length - 1]?.kind !== 'spinner'
    && random.next() < config.spinnerChance
  const id = game.nextId
  const built = useSpinner ? buildSpinner(context, id) : buildGate(context, config, id)
  const obstacle: Obstacle = 'spinner' in built ? built.spinner : built.gate
  const coins = buildCoinRoute(game.routeY, built.routeY, config.spacing, id + 1)
  const shakerDue = !useSpinner && game.gatesUntilShaker <= 1 && !game.shield
  const shaker: Pickup[] = shakerDue
    ? [{ id: id + 1 + coins.length, kind: 'shaker', x: SPAWN_X, y: built.routeY }]
    : []
  const gatesUntilShaker = shakerDue
    ? MIN_SHAKER_GAP + Math.floor(random.next() * (MAX_SHAKER_GAP - MIN_SHAKER_GAP + 1))
    : Math.max(1, game.gatesUntilShaker - 1)
  context.game = {
    ...game,
    distanceToNext: config.spacing + (useSpinner ? 0.14 : 0),
    gatesSpawned: game.gatesSpawned + 1,
    gatesUntilShaker,
    lastSide: built.side,
    nextId: id + 2 + coins.length + shaker.length,
    obstacles: [...game.obstacles, obstacle],
    pickups: [...game.pickups, ...coins, ...shaker],
    routeY: built.routeY
  }
}

function moveWorld(context: StepContext, config: LevelConfig) {
  const { dt, game } = context
  const seconds = dt / 1000
  const speed = game.speed + (config.speed - game.speed) * (1 - Math.exp(-dt / 1200))
  const move = speed * seconds
  const obstacles = game.obstacles
    .map((obstacle): Obstacle => {
      if (obstacle.kind === 'spinner') {
        return { ...obstacle, angle: obstacle.angle + obstacle.omega * seconds, x: obstacle.x - move }
      }
      return {
        ...obstacle,
        swing: obstacle.swing ? { ...obstacle.swing, phaseMs: obstacle.swing.phaseMs + dt } : null,
        x: obstacle.x - move
      }
    })
    .filter((obstacle) => obstacle.x + obstacleHalfWidth(obstacle) > -0.1)
  context.game = {
    ...game,
    distanceToNext: game.distanceToNext - move,
    obstacles,
    speed
  }
  if (context.game.distanceToNext <= 0) spawnObstacle(context, config)
}

function collectPickup(context: StepContext, pickup: Pickup) {
  const { game } = context
  if (pickup.kind === 'shaker') {
    context.events.push({ type: 'shieldUp' })
    context.game = { ...game, shield: true }
    floatText(context, '护盾', game.bird.y - 0.05, '#ffffff')
    return
  }
  const nextCoins = game.coins + 1
  context.events.push({ type: 'coin', value: nextCoins })
  context.game = { ...game, coins: nextCoins }
  addScore(context, COIN_SCORE)
}

function advancePickups(context: StepContext) {
  const { dt, game } = context
  const seconds = dt / 1000
  const move = game.speed * seconds
  const magnet = game.feverMs > 0 ? 1 - Math.exp(-dt / 110) : 0
  const moved = game.pickups
    .map((pickup) => {
      const inMagnetRange = magnet > 0 && pickup.x - BIRD_X < MAGNET_RANGE
      return {
        ...pickup,
        x: pickup.x - move,
        y: inMagnetRange ? pickup.y + (game.bird.y - pickup.y) * magnet : pickup.y
      }
    })
    .filter((pickup) => pickup.x > -0.1)
  const isCollected = (pickup: Pickup) =>
    Math.hypot(pickup.x - BIRD_X, (pickup.y - game.bird.y) * game.aspect) < COIN_PICK_RADIUS
  const collected = moved.filter(isCollected)
  context.game = { ...game, pickups: moved.filter((pickup) => !isCollected(pickup)) }
  collected.forEach((pickup) => collectPickup(context, pickup))
}

function shatterObstacle(context: StepContext, obstacle: Obstacle) {
  const { game, random } = context
  const items = Array.from({ length: 6 }, (_, index) => {
    const fromTop = index % 2 === 0
    const edges = obstacle.kind === 'gate' ? gateEdges(obstacle) : { bottom: 0.6, top: 0.4 }
    const y = obstacle.kind === 'gate'
      ? fromTop
        ? edges.top * random.next()
        : edges.bottom + (1 - edges.bottom) * random.next()
      : obstacle.y
    return {
      color: '',
      gravity: 1.5,
      kind: 'plate' as FxKind,
      lifeMs: 900,
      maxLifeMs: 900,
      rotation: random.next() * Math.PI,
      size: 0.11,
      spin: (random.next() - 0.5) * 10,
      vx: 0.1 + random.next() * 0.55,
      vy: (fromTop ? -0.1 : -0.55) * (0.6 + random.next()),
      x: obstacle.x,
      y
    }
  })
  pushFx(context, items)
  context.game = {
    ...context.game,
    obstacles: game.obstacles.filter((item) => item.id !== obstacle.id),
    shakeMs: Math.max(game.shakeMs, 160)
  }
}

function registerPass(context: StepContext, perfect: boolean) {
  const { game } = context
  const combo = game.combo + 1
  const gatesPassed = game.gatesPassed + 1
  const level = Math.floor(gatesPassed / GATES_PER_LEVEL) + 1
  context.game = {
    ...game,
    bestCombo: Math.max(game.bestCombo, combo),
    combo,
    gatesPassed,
    level,
    perfectFlashMs: perfect ? 240 : game.perfectFlashMs,
    perfects: game.perfects + (perfect ? 1 : 0)
  }
  addScore(context, perfect ? PERFECT_SCORE : GATE_SCORE)
  context.events.push({ type: perfect ? 'perfect' : 'pass', value: combo })
  if (perfect) {
    ring(context, BIRD_X, game.bird.y, '#ffc629', 0.16)
    floatText(context, '完美', game.bird.y - 0.05, '#ffc629')
  }
  if (level > game.level) {
    context.events.push({ type: 'level', value: level })
    context.game = {
      ...context.game,
      banner: { ageMs: 0, sub: levelConfig(level).name, text: `第 ${level} 关`, tone: 'level' }
    }
  }
  if (combo >= game.nextFeverCombo) startFever(context)
}

function startFever(context: StepContext) {
  const { game } = context
  context.events.push({ type: 'fever' })
  context.game = {
    ...game,
    banner: { ageMs: 0, sub: '无敌撞碎，分数翻倍', text: '燃爆', tone: 'fever' },
    feverMs: FEVER_MS,
    nextFeverCombo: game.combo + FEVER_COMBO_STEP,
    shakeMs: 200
  }
}

function loseLife(context: StepContext, obstacle: Obstacle) {
  const { game } = context
  const lives = game.lives - 1
  context.events.push({ type: 'hit', value: lives })
  context.game = {
    ...game,
    combo: 0,
    hitFlashMs: 360,
    invincibleMs: INVINCIBLE_AFTER_HIT_MS,
    lives,
    nextFeverCombo: FIRST_FEVER_COMBO,
    shakeMs: 420
  }
  shatterObstacle(context, obstacle)
  burst(context, {
    colors: ['#ffffff', '#ffd76a'],
    count: 5,
    gravity: 0.4,
    kind: 'feather',
    lifeMs: 900,
    size: 0.026,
    speed: 0.26,
    x: BIRD_X,
    y: game.bird.y
  })
  floatText(context, '-1', game.bird.y - 0.05, '#ffffff')
  if (lives > 0) return
  context.events.push({ type: 'gameOver' })
  context.game = {
    ...context.game,
    bird: { ...context.game.bird, vy: CRASH_HOP },
    status: 'crashing'
  }
}

function resolveCollision(context: StepContext, obstacle: Obstacle) {
  const { game } = context
  if (game.feverMs > 0) {
    context.events.push({ type: 'smash' })
    shatterObstacle(context, obstacle)
    registerPass(context, false)
    return
  }
  if (game.invincibleMs > 0) {
    context.game = {
      ...game,
      obstacles: game.obstacles.map((item) => (item.id === obstacle.id ? { ...item, ghosted: true } : item))
    }
    return
  }
  if (obstacle.warmup) {
    context.events.push({ type: 'bump' })
    context.game = {
      ...game,
      combo: 0,
      invincibleMs: INVINCIBLE_AFTER_SHIELD_MS,
      nextFeverCombo: FIRST_FEVER_COMBO
    }
    shatterObstacle(context, obstacle)
    floatText(context, '不扣命', game.bird.y - 0.05, '#ffffff')
    return
  }
  if (game.shield) {
    context.events.push({ type: 'shieldBreak' })
    context.game = { ...game, invincibleMs: INVINCIBLE_AFTER_SHIELD_MS, shield: false }
    shatterObstacle(context, obstacle)
    return
  }
  loseLife(context, obstacle)
}

function isPerfectPass(game: BirdGame, obstacle: Obstacle) {
  if (obstacle.kind === 'spinner') return false
  return Math.abs(game.bird.y - gateCenterNow(obstacle)) <= obstacle.gapHeight * PERFECT_ZONE
}

function resolveObstacles(context: StepContext) {
  context.game.obstacles.forEach((snapshot) => {
    const { game } = context
    if (game.status !== 'playing') return
    const obstacle = game.obstacles.find((item) => item.id === snapshot.id)
    if (!obstacle || obstacle.ghosted && obstacle.passed) return
    const collides = obstacle.kind === 'gate'
      ? birdHitsGate(game.bird.y, obstacle, game.aspect)
      : birdHitsSpinner(game.bird.y, obstacle, game.aspect)
    if (collides && !obstacle.ghosted) {
      resolveCollision(context, obstacle)
      return
    }
    const cleared = obstacle.x + obstacleHalfWidth(obstacle) + BIRD_HIT_RADIUS < BIRD_X
    if (!cleared || obstacle.passed) return
    context.game = {
      ...game,
      obstacles: game.obstacles.map((item) => (item.id === obstacle.id ? { ...item, passed: true } : item))
    }
    if (!obstacle.ghosted) registerPass(context, isPerfectPass(game, obstacle))
  })
}

function advanceReps(context: StepContext) {
  const { game } = context
  const zone = game.bird.y < REP_HIGH_LINE ? 'high' : game.bird.y > REP_LOW_LINE ? 'low' : null
  if (!zone || zone === game.repPhase) return
  const repTransitions = game.repPhase ? game.repTransitions + 1 : 0
  const reps = Math.floor(repTransitions / 2)
  context.game = { ...game, repPhase: zone, repTransitions, reps }
  if (reps > game.reps) {
    context.events.push({ type: 'rep', value: reps })
    addScore(context, REP_SCORE)
  }
}

/** 平时不留拖尾，燃爆时才有一道金色尾迹。 */
function emitTrail(context: StepContext) {
  const { game, random } = context
  if (game.feverMs <= 0 || random.next() > 0.6) return
  pushFx(context, [{
    color: FEVER_TRAIL_COLOR,
    gravity: 0,
    kind: 'puff',
    lifeMs: 420,
    maxLifeMs: 420,
    rotation: 0,
    size: 0.026,
    spin: 0,
    vx: -game.speed * 1.05,
    vy: 0,
    x: BIRD_X - BIRD_RADIUS * 0.7,
    y: game.bird.y
  }])
}

function advancePlaying(context: StepContext) {
  const { dt, input } = context
  if (!input.tracking) {
    context.game = { ...context.game, paused: true }
    return
  }
  const config = levelConfig(context.game.level)
  context.game = {
    ...context.game,
    elapsedMs: context.game.elapsedMs + dt,
    feverMs: Math.max(0, context.game.feverMs - dt),
    invincibleMs: Math.max(0, context.game.invincibleMs - dt),
    paused: false
  }
  moveWorld(context, config)
  advancePickups(context)
  resolveObstacles(context)
  if (context.game.status !== 'playing') return
  advanceReps(context)
  emitTrail(context)
}

function advanceCrashing(context: StepContext) {
  const { dt, game } = context
  const seconds = dt / 1000
  const vy = game.bird.vy + CRASH_GRAVITY * seconds
  const y = game.bird.y + vy * seconds
  const done = game.statusMs + dt >= CRASH_MAX_MS || y > 1.2
  context.game = {
    ...game,
    bird: { ...game.bird, flapMs: game.bird.flapMs + dt, rotation: game.bird.rotation + seconds * 7, vy, y },
    status: done ? 'result' : 'crashing'
  }
}

export function advanceGame(game: BirdGame, dtMs: number, input: BirdInput): BirdStep {
  const dt = clamp(dtMs, 0, MAX_STEP_MS)
  const random = createRandom(game.rng)
  const context: StepContext = { dt, events: [], game, input, random }

  // 坠落和结算时小鸟已经不归头部控制。
  if (game.status !== 'crashing' && game.status !== 'result') followInput(context)
  advanceFx(context)
  advanceTimers(context)

  if (game.status === 'countdown') advanceCountdown(context)
  else if (game.status === 'playing') advancePlaying(context)
  else if (game.status === 'crashing') advanceCrashing(context)

  const statusMs = context.game.status === game.status ? game.statusMs + dt : 0
  return { events: context.events, game: { ...context.game, rng: random.state(), statusMs } }
}
