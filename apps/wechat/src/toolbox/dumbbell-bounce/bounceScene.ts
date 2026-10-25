import {
  COUNTDOWN_MS,
  DUMBBELL_HEIGHT,
  DUMBBELL_LENGTH,
  PLATES,
  repsFromScene,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type BounceScene
} from './bounceModel'

/**
 * 实时画布和合成录制共用的绘制：物理世界（宽 1、高 16/9）按“完整放进画布”
 * 缩放后居中，所以手机画布和 448 × 800 的录制画布画出来是同一套构图、同一条轨迹。
 * 片子上印 COACHLINK 作为画面内的品牌露出，不额外压角标水印。
 */

const PLATE_FILL = '#3f3a4a'
const PLATE_RIM = '#2b2733'
const PLATE_RING = '#5a536d'
const PLATE_HUB_HOLE = '#16141b'
const HEADLINE_NUMBER = '#ff8a5c'
const STAMP_FILL = '#cf6d4e'
const BRAND_TEXT = 'COACHLINK'
const RESULT_POP_MS = 420

const IMPACT_SECONDS = 0.18

type Viewport = {
  offsetX: number
  offsetY: number
  scale: number
}

function getViewport(width: number, height: number): Viewport {
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT)
  return {
    offsetX: (width - WORLD_WIDTH * scale) / 2,
    offsetY: (height - WORLD_HEIGHT * scale) / 2,
    scale
  }
}

function impactOf(secondsSinceHit: number) {
  return secondsSinceHit >= 0 && secondsSinceHit < IMPACT_SECONDS ? 1 - secondsSinceHit / IMPACT_SECONDS : 0
}

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = Math.min(1, Math.max(0, t))
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function roundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawPlate(ctx: any, centerX: number, centerY: number, radius: number, side: 'left' | 'right', impact: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.fillStyle = PLATE_FILL
  ctx.fill()
  ctx.lineWidth = radius * 0.07
  ctx.strokeStyle = PLATE_RIM
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2)
  ctx.lineWidth = radius * 0.025
  ctx.strokeStyle = PLATE_RING
  ctx.stroke()

  ctx.lineWidth = radius * 0.045
  ctx.strokeStyle = PLATE_RING
  for (let i = 0; i < 3; i += 1) {
    const spoke = (Math.PI * 2 * i) / 3 + Math.PI / 6
    ctx.beginPath()
    ctx.moveTo(centerX + Math.cos(spoke) * radius * 0.2, centerY + Math.sin(spoke) * radius * 0.2)
    ctx.lineTo(centerX + Math.cos(spoke) * radius * 0.74, centerY + Math.sin(spoke) * radius * 0.74)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.17, 0, Math.PI * 2)
  ctx.fillStyle = PLATE_RIM
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = PLATE_HUB_HOLE
  ctx.fill()

  // 品牌字竖着印在片子朝内的一侧，左片从下往上读，右片从上往下读。
  const textX = side === 'left' ? centerX + radius * 0.66 : centerX - radius * 0.66
  ctx.translate(textX, centerY)
  ctx.rotate(side === 'left' ? -Math.PI / 2 : Math.PI / 2)
  ctx.font = `bold ${Math.round(radius * 0.13)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillText(BRAND_TEXT, 0, 0)
  ctx.restore()

  if (impact > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius * 0.97, 0, Math.PI * 2)
    ctx.lineWidth = radius * 0.06
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * impact})`
    ctx.stroke()
    ctx.restore()
  }
}

function drawDumbbell(ctx: any, x: number, y: number, length: number, height: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = height * 0.25
  ctx.shadowOffsetY = height * 0.08

  // 握把
  roundedRect(ctx, -length * 0.36, -height * 0.09, length * 0.72, height * 0.18, height * 0.09)
  ctx.fillStyle = '#c9ced6'
  ctx.fill()
  ctx.shadowColor = 'rgba(0, 0, 0, 0)'

  const plates = [
    { offset: 0.2, width: 0.12, height: 1 },
    { offset: 0.33, width: 0.1, height: 0.78 },
    { offset: 0.44, width: 0.06, height: 0.34 }
  ]
  plates.forEach((plate) => {
    const plateWidth = length * plate.width
    const plateHeight = height * plate.height
    ;[-1, 1].forEach((direction) => {
      const centerX = direction * length * plate.offset
      roundedRect(ctx, centerX - plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, plateWidth * 0.3)
      ctx.fillStyle = plate.height < 0.5 ? '#9aa1ab' : '#3b3f47'
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.fillRect(centerX - plateWidth / 2 + plateWidth * 0.18, -plateHeight / 2 + plateHeight * 0.08, plateWidth * 0.18, plateHeight * 0.84)
    })
  })
  ctx.restore()
}

function strokeFillText(ctx: any, text: string, x: number, y: number, fill: string, strokeWidth: number) {
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.85)'
  ctx.lineJoin = 'round'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function drawHeadline(ctx: any, width: number, height: number, scene: BounceScene, impact: number) {
  const reps = repsFromScene(scene)
  const numberText = reps === null ? '?' : String(reps)
  const resultPop = scene.status === 'result' ? 1 + 0.35 * (1 - easeOutBack(scene.resultAgeMs / RESULT_POP_MS)) : 1
  const hitPop = scene.status === 'bouncing' ? 1 + impact * 0.18 : 1
  const baseSize = width * 0.064
  const numberSize = width * 0.1 * Math.max(resultPop, hitPop)
  const prefix = '我今天要做 '
  const suffix = ` 个${scene.exerciseLabel}`
  const baselineY = height * 0.13

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `bold ${Math.round(baseSize)}px sans-serif`
  const prefixWidth = ctx.measureText(prefix).width
  const suffixWidth = ctx.measureText(suffix).width
  ctx.font = `bold ${Math.round(width * 0.1)}px sans-serif`
  // 数字用不放大的宽度排版，放大时只向两边“鼓”出来，前后文字不跟着跳。
  const numberWidth = ctx.measureText(numberText).width
  const startX = (width - prefixWidth - numberWidth - suffixWidth) / 2
  const stroke = width * 0.014

  ctx.font = `bold ${Math.round(baseSize)}px sans-serif`
  strokeFillText(ctx, prefix, startX, baselineY, '#ffffff', stroke)
  strokeFillText(ctx, suffix, startX + prefixWidth + numberWidth, baselineY, '#ffffff', stroke)

  ctx.font = `bold ${Math.round(numberSize)}px sans-serif`
  ctx.textAlign = 'center'
  strokeFillText(ctx, numberText, startX + prefixWidth + numberWidth / 2, baselineY + (numberSize - width * 0.1) * 0.35, HEADLINE_NUMBER, stroke * 1.2)
  ctx.restore()
}

function drawCountdown(ctx: any, width: number, height: number, countdownMs: number) {
  const remaining = Math.max(0, COUNTDOWN_MS - countdownMs)
  const value = Math.max(1, Math.ceil(remaining / 1000))
  const withinSecond = 1 - (remaining % 1000) / 1000
  const scale = 0.7 + 0.3 * easeOutBack(withinSecond / 0.35)
  const size = width * 0.34 * scale

  ctx.save()
  ctx.font = `bold ${Math.round(size)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = Math.min(1, 1.6 - withinSecond)
  strokeFillText(ctx, String(value), width / 2, height * 0.38, '#ffffff', width * 0.02)
  ctx.restore()
}

function drawResultStamp(ctx: any, width: number, height: number, scene: BounceScene) {
  const reps = repsFromScene(scene) || 0
  const label = reps === 0 ? '今天放你一马' : '就它了，开练！'
  const scale = easeOutBack(scene.resultAgeMs / RESULT_POP_MS)
  const fontSize = width * 0.05

  ctx.save()
  ctx.translate(width / 2, height * 0.2)
  ctx.rotate(-0.06)
  ctx.scale(scale, scale)
  ctx.font = `bold ${Math.round(fontSize)}px sans-serif`
  const textWidth = ctx.measureText(label).width
  const boxWidth = textWidth + fontSize * 1.6
  const boxHeight = fontSize * 1.9
  roundedRect(ctx, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, boxHeight / 2)
  ctx.fillStyle = STAMP_FILL
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, 0, fontSize * 0.04)
  ctx.restore()
}

/** 在已铺好相机画面（或透明）的画布上画整套叠层。 */
export function drawBounceScene(ctx: any, width: number, height: number, scene: BounceScene) {
  if (!width || !height) return
  const { offsetX, offsetY, scale } = getViewport(width, height)
  const leftImpact = scene.status === 'idle' ? 0 : impactOf(scene.sinceHit.left)
  const rightImpact = scene.status === 'idle' ? 0 : impactOf(scene.sinceHit.right)

  // 顶部压一层暗色，保证白字在亮背景上也看得清。
  const scrimHeight = offsetY + WORLD_HEIGHT * scale * 0.26
  const scrim = ctx.createLinearGradient(0, 0, 0, scrimHeight)
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0.38)')
  scrim.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, width, scrimHeight)

  ctx.save()
  ctx.translate(offsetX, offsetY)
  const knock = scale * 0.022
  PLATES.forEach((plate) => {
    const impact = plate.side === 'left' ? leftImpact : rightImpact
    const shift = plate.side === 'left' ? -impact * knock : impact * knock
    drawPlate(ctx, plate.x * scale + shift, plate.y * scale, plate.radius * scale, plate.side, impact)
  })

  drawDumbbell(
    ctx,
    scene.body.x * scale,
    scene.body.y * scale,
    DUMBBELL_LENGTH * scale,
    DUMBBELL_HEIGHT * scale,
    scene.body.angle
  )

  const frameWidth = WORLD_WIDTH * scale
  const frameHeight = WORLD_HEIGHT * scale
  drawHeadline(ctx, frameWidth, frameHeight, scene, Math.max(leftImpact, rightImpact))
  if (scene.status === 'countdown') {
    drawCountdown(ctx, frameWidth, frameHeight, scene.countdownMs)
  }
  if (scene.status === 'result') {
    drawResultStamp(ctx, frameWidth, frameHeight, scene)
  }
  ctx.restore()
}
