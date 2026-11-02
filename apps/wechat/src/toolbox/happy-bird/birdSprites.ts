import {
  BIRD_RADIUS,
  BIRD_X,
  gateEdges,
  type BirdGame,
  type Fx,
  type GateObstacle,
  type Pickup,
  type SpinnerObstacle
} from './birdModel'

/** 画面里的物件：杠铃片塔、飞天杠铃、能量豆、摇杯、小鸟和特效粒子。 */

type PlateColor = { base: string; dark: string; light: string }

type TowerPalette = { even: PlateColor; odd: PlateColor }

// 塔只用一个品牌色系，深浅相间看出是一片片杠铃片；燃爆时整体换金色，这是唯一的变色。
const TOWER_COLORS: TowerPalette = {
  even: { base: '#cf6d4e', dark: '#8f4026', light: '#eeaa92' },
  odd: { base: '#c26243', dark: '#863a22', light: '#e59c83' }
}
const FEVER_TOWER_COLORS: TowerPalette = {
  even: { base: '#f5b92e', dark: '#b98300', light: '#ffe08a' },
  odd: { base: '#eaab1f', dark: '#a97600', light: '#ffd76a' }
}
const PLATE_WIDTH_PATTERN = [1, 0.97]
const STEEL = { base: '#c7ccd4', dark: '#6d7480', light: '#f6f8fa' }
const OUTLINE = '#2a1b0f'
export const BRAND = '#cf6d4e'
export const GOLD = '#ffc629'
export const FONT = 'sans-serif'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function roundedRectPath(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export function outlinedText(ctx: any, text: string, x: number, y: number, fill: string, strokeWidth: number, stroke = 'rgba(0, 0, 0, 0.55)') {
  ctx.lineJoin = 'round'
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = stroke
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** 一片杠铃片的侧面：圆角长条 + 同一位置的高光和暗面，叠起来像一根有光泽的圆柱。 */
function drawPlate(ctx: any, cx: number, y: number, width: number, height: number, color: PlateColor) {
  const x = cx - width / 2
  roundedRectPath(ctx, x, y, width, height, height * 0.3)
  ctx.fillStyle = color.base
  ctx.fill()
  ctx.lineWidth = Math.max(1, height * 0.05)
  ctx.strokeStyle = 'rgba(20, 12, 8, 0.35)'
  ctx.stroke()

  const inset = height * 0.14
  ctx.fillStyle = color.dark
  ctx.globalAlpha = 0.4
  ctx.fillRect(x + width * 0.82, y + inset, width * 0.13, height - inset * 2)
  ctx.fillStyle = color.light
  ctx.globalAlpha = 0.6
  ctx.fillRect(x + width * 0.14, y + inset, width * 0.12, height - inset * 2)
  ctx.globalAlpha = 1
}

function drawCollar(ctx: any, cx: number, y: number, width: number, height: number) {
  const x = cx - width / 2
  roundedRectPath(ctx, x, y, width, height, height * 0.34)
  ctx.fillStyle = STEEL.base
  ctx.fill()
  ctx.lineWidth = Math.max(1, height * 0.1)
  ctx.strokeStyle = 'rgba(20, 12, 8, 0.7)'
  ctx.stroke()
  ctx.fillStyle = STEEL.light
  ctx.fillRect(x + width * 0.08, y + height * 0.18, width * 0.84, height * 0.2)
  ctx.fillStyle = STEEL.dark
  ctx.globalAlpha = 0.6
  ctx.fillRect(x + width * 0.08, y + height * 0.66, width * 0.84, height * 0.14)
  ctx.globalAlpha = 1
}

/** 从通道边缘向屏幕外堆杠铃片，边缘压一圈钢制卡扣，形成清晰可读的“门框”。 */
function drawPlateTower(
  ctx: any,
  cx: number,
  edgeY: number,
  direction: -1 | 1,
  towerWidth: number,
  height: number,
  palette: TowerPalette
) {
  const collarHeight = height * 0.024
  const plateHeight = height * 0.04
  const limit = direction < 0 ? edgeY : height - edgeY
  const count = Math.ceil((limit - collarHeight) / plateHeight) + 1
  for (let index = count - 1; index >= 0; index -= 1) {
    const offset = collarHeight + plateHeight * index
    const y = direction < 0 ? edgeY - offset - plateHeight : edgeY + offset
    const color = index % 2 === 0 ? palette.even : palette.odd
    const widthFactor = PLATE_WIDTH_PATTERN[index % PLATE_WIDTH_PATTERN.length]
    drawPlate(ctx, cx, y, towerWidth * widthFactor, plateHeight, color)
  }
  const collarY = direction < 0 ? edgeY - collarHeight : edgeY
  drawCollar(ctx, cx, collarY, towerWidth * 1.14, collarHeight)
}

export function drawGate(ctx: any, gate: GateObstacle, width: number, height: number, fever: boolean) {
  const cx = gate.x * width
  const towerWidth = gate.width * width
  const edges = gateEdges(gate)
  const palette = fever ? FEVER_TOWER_COLORS : TOWER_COLORS
  drawPlateTower(ctx, cx, edges.top * height, -1, towerWidth, height, palette)
  drawPlateTower(ctx, cx, edges.bottom * height, 1, towerWidth, height, palette)
}

export function drawSpinner(ctx: any, spinner: SpinnerObstacle, width: number, height: number, fever: boolean) {
  const halfLength = spinner.halfLength * width
  const barThickness = width * 0.018
  const palette = fever ? FEVER_TOWER_COLORS : TOWER_COLORS
  const plateSets = [
    { color: palette.even, height: width * 0.15, offset: 0.7, thick: width * 0.04 },
    { color: palette.odd, height: width * 0.12, offset: 0.88, thick: width * 0.034 }
  ]
  ctx.save()
  ctx.translate(spinner.x * width, spinner.y * height)
  ctx.rotate(spinner.angle)
  roundedRectPath(ctx, -halfLength * 1.08, -barThickness / 2, halfLength * 2.16, barThickness, barThickness / 2)
  ctx.fillStyle = STEEL.base
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(20, 12, 8, 0.7)'
  ctx.stroke()
  ctx.fillStyle = STEEL.light
  ctx.fillRect(-halfLength, -barThickness * 0.32, halfLength * 2, barThickness * 0.2)
  ;[-1, 1].forEach((side) => {
    plateSets.forEach((plate) => {
      const x = side * halfLength * plate.offset - plate.thick / 2
      roundedRectPath(ctx, x, -plate.height / 2, plate.thick, plate.height, plate.thick * 0.35)
      ctx.fillStyle = plate.color.base
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(20, 12, 8, 0.6)'
      ctx.stroke()
    })
  })
  ctx.restore()
}

export function drawCoin(ctx: any, pickup: Pickup, width: number, height: number) {
  ctx.beginPath()
  ctx.arc(pickup.x * width, pickup.y * height, width * 0.024, 0, Math.PI * 2)
  ctx.fillStyle = GOLD
  ctx.fill()
  ctx.lineWidth = width * 0.004
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.stroke()
}

export function drawShaker(ctx: any, pickup: Pickup, width: number, height: number) {
  const size = width * 0.05
  const cx = pickup.x * width
  const cy = pickup.y * height
  ctx.beginPath()
  ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.stroke()
  roundedRectPath(ctx, cx - size * 0.56, cy - size * 0.56, size * 1.12, size * 1.5, size * 0.2)
  ctx.fillStyle = '#f7fbff'
  ctx.fill()
  ctx.lineWidth = size * 0.1
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  roundedRectPath(ctx, cx - size * 0.56, cy + size * 0.1, size * 1.12, size * 0.84, size * 0.2)
  ctx.fillStyle = '#39b7e8'
  ctx.fill()
  roundedRectPath(ctx, cx - size * 0.48, cy - size * 0.98, size * 0.96, size * 0.42, size * 0.1)
  ctx.fillStyle = '#28303c'
  ctx.fill()
}

function drawBirdEye(ctx: any, r: number, mood: 'dizzy' | 'happy' | 'normal') {
  const eyeX = r * 0.38
  const eyeY = -r * 0.2
  if (mood === 'happy') {
    ctx.beginPath()
    ctx.arc(eyeX, eyeY + r * 0.1, r * 0.2, Math.PI * 1.1, Math.PI * 1.9)
    ctx.lineWidth = r * 0.13
    ctx.lineCap = 'round'
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    ctx.lineCap = 'butt'
    return
  }
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, r * 0.31, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = r * 0.08
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  if (mood === 'dizzy') {
    const arm = r * 0.15
    ctx.lineWidth = r * 0.1
    ctx.beginPath()
    ctx.moveTo(eyeX - arm, eyeY - arm)
    ctx.lineTo(eyeX + arm, eyeY + arm)
    ctx.moveTo(eyeX + arm, eyeY - arm)
    ctx.lineTo(eyeX - arm, eyeY + arm)
    ctx.stroke()
    return
  }
  ctx.beginPath()
  ctx.arc(eyeX + r * 0.08, eyeY + r * 0.02, r * 0.15, 0, Math.PI * 2)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eyeX + r * 0.13, eyeY - r * 0.05, r * 0.05, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}

/** 小鸟：圆滚滚的黄色身体 + 红色运动头带。 */
export function drawBird(ctx: any, game: BirdGame, width: number, height: number) {
  const r = BIRD_RADIUS * width
  const flap = Math.sin(game.bird.flapMs / 62)
  const mood = game.status === 'crashing' || game.status === 'result' || game.hitFlashMs > 0
    ? 'dizzy'
    : game.feverMs > 0 || game.perfectFlashMs > 0
      ? 'happy'
      : 'normal'
  const blinking = game.invincibleMs > 0 && game.feverMs <= 0 && Math.floor(game.invincibleMs / 90) % 2 === 0
  const bob = game.status === 'idle' ? Math.sin(game.bird.flapMs / 320) * height * 0.006 : 0

  ctx.save()
  ctx.translate(BIRD_X * width, game.bird.y * height + bob)
  ctx.rotate(game.bird.rotation)
  ctx.globalAlpha = blinking ? 0.42 : 1

  // 头带飘带
  ctx.fillStyle = '#e8434a'
  ;[0.32, -0.08].forEach((tilt, index) => {
    const wave = Math.sin(game.bird.flapMs / 90 + index) * r * 0.16
    ctx.beginPath()
    ctx.moveTo(-r * 0.78, -r * 0.5)
    ctx.quadraticCurveTo(-r * 1.25, -r * 0.5 + wave, -r * 1.62, -r * (0.42 - tilt) + wave)
    ctx.lineTo(-r * 1.5, -r * (0.2 - tilt) + wave)
    ctx.quadraticCurveTo(-r * 1.15, -r * 0.24 + wave, -r * 0.76, -r * 0.26)
    ctx.closePath()
    ctx.fill()
  })

  // 身体
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffcb2e'
  ctx.fill()
  ctx.lineWidth = r * 0.11
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(r * 0.1, r * 0.42, r * 0.66, r * 0.46, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffeaa3'
  ctx.fill()

  // 头带：贴着身体上沿的弧形宽带，白色细条让它更像真头带。
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.945, 0, Math.PI * 2)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(-r * 1.1, -r * 0.36)
  ctx.quadraticCurveTo(0, -r * 0.82, r * 1.1, -r * 0.5)
  ctx.lineTo(r * 1.1, -r * 0.92)
  ctx.quadraticCurveTo(0, -r * 1.2, -r * 1.1, -r * 0.76)
  ctx.closePath()
  ctx.fillStyle = '#e8434a'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-r * 1.1, -r * 0.54)
  ctx.quadraticCurveTo(0, -r * 1, r * 1.1, -r * 0.7)
  ctx.lineWidth = r * 0.07
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.restore()

  drawBirdEye(ctx, r, mood)

  // 嘴
  ctx.beginPath()
  ctx.moveTo(r * 0.72, -r * 0.06)
  ctx.quadraticCurveTo(r * 1.44, r * 0.02, r * 1.34, r * 0.2)
  ctx.quadraticCurveTo(r * 1, r * 0.3, r * 0.7, r * 0.22)
  ctx.closePath()
  ctx.fillStyle = '#ff8a2a'
  ctx.fill()
  ctx.lineWidth = r * 0.08
  ctx.strokeStyle = OUTLINE
  ctx.stroke()

  // 翅膀
  ctx.save()
  ctx.translate(-r * 0.3, r * 0.14)
  ctx.rotate(flap * 0.75 - 0.2)
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ff9f2e'
  ctx.fill()
  ctx.lineWidth = r * 0.09
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.restore()

  ctx.restore()
  ctx.globalAlpha = 1
}

export function drawShieldBubble(ctx: any, game: BirdGame, width: number, height: number) {
  if (!game.shield) return
  const r = BIRD_RADIUS * width * 1.55
  const cx = BIRD_X * width
  const cy = game.bird.y * height
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fill()
  ctx.lineWidth = r * 0.07
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.stroke()
}

export function drawFeverAura(ctx: any, game: BirdGame, width: number, height: number) {
  if (game.feverMs <= 0) return
  ctx.beginPath()
  ctx.arc(BIRD_X * width, game.bird.y * height, BIRD_RADIUS * width * 1.55, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 198, 41, 0.32)'
  ctx.fill()
}

export function drawFx(ctx: any, item: Fx, width: number, height: number, fever: boolean) {
  const progress = clamp(item.lifeMs / item.maxLifeMs, 0, 1)
  const x = item.x * width
  const y = item.y * height
  const size = item.size * width
  if (item.kind === 'ring') {
    ctx.beginPath()
    ctx.arc(x, y, size * (1.25 - progress), 0, Math.PI * 2)
    ctx.globalAlpha = progress
    ctx.lineWidth = Math.max(1.5, size * 0.2 * progress)
    ctx.strokeStyle = item.color
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }
  if (item.kind === 'text') {
    ctx.globalAlpha = Math.min(1, progress * 2)
    ctx.font = `bold ${Math.round(size)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    outlinedText(ctx, item.text || '', x, y, item.color, Math.max(2, size * 0.12))
    ctx.globalAlpha = 1
    return
  }
  if (item.kind === 'puff') {
    ctx.beginPath()
    ctx.arc(x, y, size * (0.5 + progress * 0.5), 0, Math.PI * 2)
    ctx.globalAlpha = progress * 0.85
    ctx.fillStyle = item.color
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(item.rotation)
  ctx.globalAlpha = Math.min(1, progress * 1.6)
  if (item.kind === 'plate') {
    const color = (fever ? FEVER_TOWER_COLORS : TOWER_COLORS).even
    drawPlate(ctx, 0, -size * 0.17, size, size * 0.34, color)
  } else {
    ctx.beginPath()
    ctx.ellipse(0, 0, size, size * 0.34, 0, 0, Math.PI * 2)
    ctx.fillStyle = item.color
    ctx.fill()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}
