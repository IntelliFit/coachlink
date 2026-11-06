import {
  BEAN_BANNER_MS,
  BEAN_COUNTDOWN_MS,
  BEAN_GO_MS,
  BEAN_RADIUS,
  beanTitle,
  comboMultiplier,
  inSprint,
  timeLeftMs,
  type Bean,
  type BeanFx,
  type BeanGame
} from './beanModel'

/**
 * 实时画布和录制画布共用的绘制。相机里的人是主角：脸上不画任何东西，
 * 常驻的只有豆子、分数和倒计时，其余信息只在该出现的瞬间出现。
 */

export type BeanSceneExtras = {
  bestScore: number
}

const FONT = 'sans-serif'
const BRAND = '#cf6d4e'
const GOLD = '#ffc629'

const BEAN_COLORS: Record<Bean['kind'], { base: string; light: string; rim: string }> = {
  bad: { base: '#26232b', light: '#55505e', rim: 'rgba(255, 255, 255, 0.85)' },
  gold: { base: '#ffc629', light: '#fff0b0', rim: '#ffffff' },
  good: { base: '#5dbb63', light: '#b6eab0', rim: 'rgba(255, 255, 255, 0.9)' }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function setCenteredText(ctx: any, size: number, weight = 'bold') {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

function outlinedText(ctx: any, text: string, x: number, y: number, fill: string, strokeWidth: number) {
  ctx.lineJoin = 'round'
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function roundedRectPath(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

/** 捣蛋豆长了一双瞪人的眼睛，不用读说明也知道要躲。 */
function drawBadEyes(ctx: any, r: number) {
  ;[-1, 1].forEach((side) => {
    ctx.beginPath()
    ctx.arc(side * r * 0.32, -r * 0.02, r * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(side * r * 0.28, r * 0.02, r * 0.09, 0, Math.PI * 2)
    ctx.fillStyle = '#26232b'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(side * r * 0.58, -r * 0.36)
    ctx.lineTo(side * r * 0.12, -r * 0.16)
    ctx.lineWidth = r * 0.11
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  })
}

export function drawBean(ctx: any, bean: Pick<Bean, 'kind' | 'rotation' | 'x' | 'y'>, width: number, height: number) {
  const r = BEAN_RADIUS[bean.kind] * width
  const colors = BEAN_COLORS[bean.kind]
  ctx.save()
  ctx.translate(bean.x * width, bean.y * height)
  // 坏豆不转，眼睛始终朝前才认得出。
  if (bean.kind !== 'bad') ctx.rotate(bean.rotation)
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2)
  ctx.fillStyle = colors.base
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.1)
  ctx.strokeStyle = colors.rim
  ctx.stroke()
  if (bean.kind === 'bad') {
    drawBadEyes(ctx, r)
  } else {
    ctx.beginPath()
    ctx.ellipse(-r * 0.3, -r * 0.26, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2)
    ctx.fillStyle = colors.light
    ctx.fill()
  }
  ctx.restore()
}

function drawFx(ctx: any, item: BeanFx, width: number, height: number) {
  const progress = clamp(item.lifeMs / item.maxLifeMs, 0, 1)
  const x = item.x * width
  const y = item.y * height
  const size = item.size * width
  ctx.save()
  if (item.kind === 'ring') {
    ctx.globalAlpha = progress
    ctx.beginPath()
    ctx.arc(x, y, size * (1.1 - progress * 0.6), 0, Math.PI * 2)
    ctx.lineWidth = Math.max(1.5, size * 0.14 * progress)
    ctx.strokeStyle = item.color
    ctx.stroke()
  } else {
    ctx.globalAlpha = Math.min(1, progress * 2)
    setCenteredText(ctx, size)
    outlinedText(ctx, item.text || '', x, y - (1 - progress) * height * 0.04, item.color, Math.max(2, size * 0.12))
  }
  ctx.restore()
}

function drawHud(ctx: any, game: BeanGame, width: number, height: number) {
  const pop = 1 + (game.scorePopMs / 220) * 0.1
  setCenteredText(ctx, width * 0.11 * pop)
  outlinedText(ctx, String(game.score), width / 2, height * 0.052, '#ffffff', width * 0.008)

  const multiplier = comboMultiplier(game.combo)
  if (game.combo >= 3) {
    setCenteredText(ctx, width * 0.034)
    const label = multiplier > 1 ? `连击 ${game.combo} · 分数 ×${multiplier}` : `连击 ${game.combo}`
    outlinedText(ctx, label, width / 2, height * 0.094, multiplier > 1 ? GOLD : '#ffffff', width * 0.005)
  }

  ctx.font = `bold ${Math.round(width * 0.052)}px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  outlinedText(ctx, `${Math.ceil(timeLeftMs(game) / 1000)}s`, width * 0.95, height * 0.036, inSprint(game) ? GOLD : '#ffffff', width * 0.006)
}

function drawBanner(ctx: any, game: BeanGame, width: number, height: number) {
  const banner = game.banner
  if (!banner) return
  ctx.save()
  ctx.globalAlpha = clamp(Math.min(banner.ageMs / 180, (BEAN_BANNER_MS - banner.ageMs) / 300), 0, 1)
  setCenteredText(ctx, width * 0.075)
  outlinedText(ctx, banner.text, width / 2, height * 0.2, GOLD, width * 0.008)
  setCenteredText(ctx, width * 0.036)
  outlinedText(ctx, banner.sub, width / 2, height * 0.245, '#ffffff', width * 0.005)
  ctx.restore()
}

/** 待机时摆一组豆子当图例：不用读规则卡片，看一眼就知道吃哪个、躲哪个。 */
function drawIdle(ctx: any, game: BeanGame, width: number, height: number) {
  const rowY = 0.13
  const items: { kind: Bean['kind']; label: string; x: number }[] = [
    { kind: 'good', label: '+1', x: 0.26 },
    { kind: 'gold', label: '+5', x: 0.5 },
    { kind: 'bad', label: '躲开', x: 0.74 }
  ]
  items.forEach((item) => {
    drawBean(ctx, { kind: item.kind, rotation: 0, x: item.x, y: rowY }, width, height)
    setCenteredText(ctx, width * 0.036)
    outlinedText(ctx, item.label, item.x * width, (rowY + 0.05) * height, '#ffffff', width * 0.005)
  })
  setCenteredText(ctx, width * 0.042)
  outlinedText(ctx, game.tracking ? '豆子碰到脸就算吃到' : '让脸进入画面', width / 2, height * 0.24, '#ffffff', width * 0.006)
}

function drawCountdown(ctx: any, game: BeanGame, width: number, height: number) {
  const remaining = Math.max(0, BEAN_COUNTDOWN_MS - game.statusMs)
  setCenteredText(ctx, width * 0.26)
  outlinedText(ctx, String(Math.max(1, Math.ceil(remaining / 1000))), width / 2, height * 0.2, '#ffffff', width * 0.012)
  setCenteredText(ctx, width * 0.038)
  outlinedText(ctx, '站远一点，让脸留在画面里', width / 2, height * 0.3, '#ffffff', width * 0.006)
}

function drawGo(ctx: any, game: BeanGame, width: number, height: number) {
  if (game.goMs <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(game.goMs / (BEAN_GO_MS * 0.5), 0, 1)
  setCenteredText(ctx, width * 0.14)
  outlinedText(ctx, '开吃', width / 2, height * 0.2, '#ffffff', width * 0.01)
  ctx.restore()
}

function drawPaused(ctx: any, width: number, height: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.fillRect(0, 0, width, height)
  setCenteredText(ctx, width * 0.042)
  outlinedText(ctx, '看不到你的脸了，回到画面自动继续', width / 2, height * 0.42, '#ffffff', width * 0.006)
}

function drawResult(ctx: any, game: BeanGame, width: number, height: number, extras: BeanSceneExtras) {
  const newBest = game.score > 0 && game.score > extras.bestScore
  const cardWidth = width * 0.72
  const cardHeight = cardWidth * 0.86
  const appear = clamp(game.statusMs / 240, 0, 1)

  ctx.save()
  ctx.globalAlpha = appear
  ctx.translate(width / 2, height * 0.36 + (1 - appear) * height * 0.015)
  roundedRectPath(ctx, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cardWidth * 0.06)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  setCenteredText(ctx, cardWidth * 0.05, 'normal')
  ctx.fillStyle = newBest ? BRAND : '#8a8580'
  ctx.fillText(newBest ? '新纪录' : '本局得分', 0, -cardHeight * 0.36)
  setCenteredText(ctx, cardWidth * 0.24)
  ctx.fillStyle = '#1c1917'
  ctx.fillText(String(game.score), 0, -cardHeight * 0.17)
  setCenteredText(ctx, cardWidth * 0.06)
  ctx.fillStyle = BRAND
  ctx.fillText(beanTitle(game.score), 0, cardHeight * 0.02)

  setCenteredText(ctx, cardWidth * 0.046, 'normal')
  ctx.fillStyle = '#57534e'
  ctx.fillText(`吃到 ${game.caught} · 金豆 ${game.golds} · 最高连击 ${game.bestCombo}`, 0, cardHeight * 0.17)
  ctx.fillStyle = '#8a8580'
  ctx.fillText(`历史最佳 ${Math.max(extras.bestScore, game.score)}`, 0, cardHeight * 0.27)
  setCenteredText(ctx, cardWidth * 0.036, 'normal')
  ctx.fillStyle = '#a8a29e'
  ctx.fillText('接豆派对 · COACHLINK', 0, cardHeight * 0.4)
  ctx.restore()
}

function drawTopScrim(ctx: any, width: number, height: number) {
  const scrimHeight = height * 0.14
  const scrim = ctx.createLinearGradient(0, 0, 0, scrimHeight)
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0.28)')
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, width, scrimHeight)
}

/** 在已铺好相机画面（或透明）的画布上画整套游戏叠层。 */
export function drawBeanScene(ctx: any, width: number, height: number, game: BeanGame, extras: BeanSceneExtras) {
  if (!width || !height) return
  drawTopScrim(ctx, width, height)

  if (game.status === 'idle') {
    drawIdle(ctx, game, width, height)
    return
  }
  if (game.status === 'countdown') {
    drawCountdown(ctx, game, width, height)
    return
  }
  if (game.status === 'result') {
    drawResult(ctx, game, width, height, extras)
    return
  }

  game.beans.forEach((bean) => drawBean(ctx, bean, width, height))
  game.fx.forEach((item) => drawFx(ctx, item, width, height))
  if (game.flashMs > 0) {
    ctx.fillStyle = `rgba(220, 40, 40, ${(game.flashMs / 300) * 0.16})`
    ctx.fillRect(0, 0, width, height)
  }
  drawHud(ctx, game, width, height)
  drawGo(ctx, game, width, height)
  drawBanner(ctx, game, width, height)
  if (game.paused) drawPaused(ctx, width, height)
}
