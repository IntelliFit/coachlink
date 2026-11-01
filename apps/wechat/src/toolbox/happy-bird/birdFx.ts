import { BIRD_X, type BirdEvent, type BirdGame, type BirdInput, type Fx, type FxKind } from './birdTypes'

/** 随机数和一帧内的上下文，以及往状态里加特效粒子的小工具。 */

const MAX_FX = 150

export function createRandom(seed: number) {
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

type RandomSource = ReturnType<typeof createRandom>

export type StepContext = {
  dt: number
  events: BirdEvent[]
  game: BirdGame
  input: BirdInput
  random: RandomSource
}

export function pushFx(context: StepContext, items: Omit<Fx, 'id'>[]) {
  const { game } = context
  const stamped = items.map((item, index) => ({ ...item, id: game.nextId + index }))
  context.game = {
    ...game,
    fx: [...game.fx, ...stamped].slice(-MAX_FX),
    nextId: game.nextId + items.length
  }
}

type BurstOptions = {
  colors: string[]
  count: number
  gravity?: number
  kind: FxKind
  lifeMs: number
  size: number
  speed: number
  x: number
  y: number
}

export function burst(context: StepContext, options: BurstOptions) {
  const { random } = context
  const items = Array.from({ length: options.count }, (_, index) => {
    const angle = random.next() * Math.PI * 2
    const speed = options.speed * (0.45 + random.next() * 0.75)
    return {
      color: options.colors[index % options.colors.length],
      gravity: options.gravity ?? 0.9,
      kind: options.kind,
      lifeMs: options.lifeMs * (0.7 + random.next() * 0.5),
      maxLifeMs: options.lifeMs * 1.2,
      rotation: random.next() * Math.PI * 2,
      size: options.size * (0.7 + random.next() * 0.6),
      spin: (random.next() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: (Math.sin(angle) * speed) / context.game.aspect,
      x: options.x,
      y: options.y
    }
  })
  pushFx(context, items)
}

export function ring(context: StepContext, x: number, y: number, color: string, size: number) {
  pushFx(context, [{
    color,
    gravity: 0,
    kind: 'ring',
    lifeMs: 420,
    maxLifeMs: 420,
    rotation: 0,
    size,
    spin: 0,
    vx: -context.game.speed * 0.4,
    vy: 0,
    x,
    y
  }])
}

export function floatText(context: StepContext, text: string, y: number, color: string, size = 0.05) {
  pushFx(context, [{
    color,
    gravity: 0,
    kind: 'text',
    lifeMs: 800,
    maxLifeMs: 800,
    rotation: 0,
    size,
    spin: 0,
    text,
    vx: 0.02,
    vy: -0.11,
    x: BIRD_X + 0.14,
    y
  }])
}
