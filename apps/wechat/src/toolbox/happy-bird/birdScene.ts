import {
  birdTitle,
  COUNTDOWN_MS,
  MAX_LIVES,
  type BirdGame
} from './birdModel'
import {
  BRAND,
  clamp,
  drawBird,
  drawCoin,
  drawFeverAura,
  drawFx,
  drawGate,
  drawShaker,
  drawShieldBubble,
  drawSpinner,
  FONT,
  GOLD,
  outlinedText,
  roundedRectPath
} from './birdSprites'

/**
 * 实时画布和录制画布共用的绘制：只依赖 BirdGame 和画布尺寸，
 * 所以回放和玩的时候看到的是同一套画面。全部用代码绘制，不占小程序包体积。
 *
 * 画面原则：相机里的人是主角，常驻的只有塔、鸟、分数和命，其余信息只在该出现的瞬间出现。
 */

export type BirdSceneExtras = {
  bestScore: number
}

function setCenteredText(ctx: any, size: number, weight = 'bold') {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

function drawHeart(ctx: any, cx: number, cy: number, size: number, filled: boolean) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + size * 0.42)
  ctx.bezierCurveTo(cx - size * 0.62, cy - size * 0.02, cx - size * 0.4, cy - size * 0.5, cx, cy - size * 0.2)
  ctx.bezierCurveTo(cx + size * 0.4, cy - size * 0.5, cx + size * 0.62, cy - size * 0.02, cx, cy + size * 0.42)
  ctx.closePath()
  ctx.fillStyle = filled ? '#ffffff' : 'rgba(255, 255, 255, 0.28)'
  ctx.fill()
}

function drawHud(ctx: any, game: BirdGame, width: number, height: number) {
  const heartSize = width * 0.05
  for (let index = 0; index < MAX_LIVES; index += 1) {
    drawHeart(ctx, width * 0.055 + index * heartSize * 1.15, height * 0.036, heartSize, index < game.lives)
  }

  const pop = 1 + (game.scorePopMs / 260) * 0.1
  setCenteredText(ctx, width * 0.11 * pop)
  outlinedText(ctx, String(game.score), width / 2, height * 0.052, game.feverMs > 0 ? GOLD : '#ffffff', width * 0.008)

  if (game.combo >= 3) {
    setCenteredText(ctx, width * 0.034)
    outlinedText(ctx, `连击 ${game.combo}`, width / 2, height * 0.094, '#ffffff', width * 0.005)
  }
}

/** 换关、燃爆只用一行字淡入淡出，不再弹卡片。 */
function drawBanner(ctx: any, game: BirdGame, width: number, height: number) {
  const banner = game.banner
  if (!banner || banner.ageMs < 0) return
  const alpha = clamp(Math.min(banner.ageMs / 180, (1500 - banner.ageMs) / 300), 0, 1)
  ctx.save()
  ctx.globalAlpha = alpha
  setCenteredText(ctx, width * 0.075)
  outlinedText(ctx, banner.text, width / 2, height * 0.2, banner.tone === 'fever' ? GOLD : '#ffffff', width * 0.008)
  setCenteredText(ctx, width * 0.036)
  outlinedText(ctx, banner.sub, width / 2, height * 0.245, '#ffffff', width * 0.005)
  ctx.restore()
}

function drawIdle(ctx: any, game: BirdGame, width: number, height: number) {
  setCenteredText(ctx, width * 0.042)
  outlinedText(
    ctx,
    game.tracking ? '头上下动，小鸟跟着飞' : '让脸进入画面',
    width / 2,
    height * 0.14,
    '#ffffff',
    width * 0.006
  )
}

function drawCountdown(ctx: any, game: BirdGame, width: number, height: number) {
  const remaining = Math.max(0, COUNTDOWN_MS - game.statusMs)
  setCenteredText(ctx, width * 0.26)
  outlinedText(ctx, String(Math.max(1, Math.ceil(remaining / 1000))), width / 2, height * 0.2, '#ffffff', width * 0.012)
  setCenteredText(ctx, width * 0.038)
  outlinedText(ctx, '到位准备，让脸留在画面里', width / 2, height * 0.3, '#ffffff', width * 0.006)
}

function drawGo(ctx: any, game: BirdGame, width: number, height: number) {
  if (game.goMs <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(game.goMs / 300, 0, 1)
  setCenteredText(ctx, width * 0.14)
  outlinedText(ctx, '开飞', width / 2, height * 0.2, '#ffffff', width * 0.01)
  ctx.restore()
}

function drawPaused(ctx: any, width: number, height: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.fillRect(0, 0, width, height)
  setCenteredText(ctx, width * 0.042)
  outlinedText(ctx, '看不到你的脸了，回到画面自动继续', width / 2, height * 0.42, '#ffffff', width * 0.006)
}

function drawResult(ctx: any, game: BirdGame, width: number, height: number, extras: BirdSceneExtras) {
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
  ctx.fillText(birdTitle(game.score), 0, cardHeight * 0.02)

  setCenteredText(ctx, cardWidth * 0.046, 'normal')
  ctx.fillStyle = '#57534e'
  ctx.fillText(
    `穿越 ${game.gatesPassed} · 动作 ${game.reps} · 坚持 ${Math.floor(game.elapsedMs / 1000)} 秒`,
    0,
    cardHeight * 0.17
  )
  ctx.fillStyle = '#8a8580'
  ctx.fillText(`历史最佳 ${Math.max(extras.bestScore, game.score)}`, 0, cardHeight * 0.27)
  setCenteredText(ctx, cardWidth * 0.036, 'normal')
  ctx.fillStyle = '#a8a29e'
  ctx.fillText('快乐小鸟 · COACHLINK', 0, cardHeight * 0.4)
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

function shakeOffset(game: BirdGame, width: number) {
  if (game.shakeMs <= 0) return { x: 0, y: 0 }
  const strength = (game.shakeMs / 420) * width * 0.012
  return {
    x: Math.sin(game.shakeMs * 0.09) * strength,
    y: Math.cos(game.shakeMs * 0.13) * strength
  }
}

function drawWorld(ctx: any, game: BirdGame, width: number, height: number) {
  const fever = game.feverMs > 0
  const fading = game.status === 'crashing' || game.status === 'result'
  const worldAlpha = fading ? clamp(1 - game.statusMs / 650, 0, 1) : 1
  if (worldAlpha > 0 && game.status !== 'result') {
    ctx.globalAlpha = worldAlpha
    game.pickups.forEach((pickup) => {
      if (pickup.kind === 'coin') drawCoin(ctx, pickup, width, height)
      else drawShaker(ctx, pickup, width, height)
      ctx.globalAlpha = worldAlpha
    })
    game.obstacles.forEach((obstacle) => {
      if (obstacle.kind === 'gate') drawGate(ctx, obstacle, width, height, fever)
      else drawSpinner(ctx, obstacle, width, height, fever)
      ctx.globalAlpha = worldAlpha
    })
    ctx.globalAlpha = 1
  }
  game.fx.filter((item) => item.kind === 'puff').forEach((item) => drawFx(ctx, item, width, height, fever))
  if (game.status !== 'result') {
    drawFeverAura(ctx, game, width, height)
    drawBird(ctx, game, width, height)
    drawShieldBubble(ctx, game, width, height)
  }
  game.fx.filter((item) => item.kind !== 'puff').forEach((item) => drawFx(ctx, item, width, height, fever))
}

/** 在已铺好相机画面（或透明）的画布上画整套游戏叠层。 */
export function drawBirdScene(ctx: any, width: number, height: number, game: BirdGame, extras: BirdSceneExtras) {
  if (!width || !height) return

  drawTopScrim(ctx, width, height)

  const shake = shakeOffset(game, width)
  ctx.save()
  ctx.translate(shake.x, shake.y)
  drawWorld(ctx, game, width, height)
  ctx.restore()

  if (game.hitFlashMs > 0) {
    ctx.fillStyle = `rgba(220, 40, 40, ${(game.hitFlashMs / 360) * 0.16})`
    ctx.fillRect(0, 0, width, height)
  }

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
  drawHud(ctx, game, width, height)
  if (game.status === 'playing') {
    drawGo(ctx, game, width, height)
    drawBanner(ctx, game, width, height)
    if (game.paused) drawPaused(ctx, width, height)
  }
}
