/**
 * 薄肌检测器的两张分享图（2026-10-26 改版，海报 2026-10-27 重排）：
 * - 朋友圈海报 750×1334：成绩 + 最像谁 + 四项得分 + PK 小程序码，保存或用图片菜单直接发朋友圈；
 * - 好友卡片 500×400（5:4）：发给微信好友时聊天里显示的封面。
 * 都只画分数和称号，不画照片。
 */

import type { BojiMetricKey, BojiSex } from '@coachlink/core/src/bojiDetector'
import { bojiDisplayKeys, bojiShortMetricLabel } from '@coachlink/core/src/bojiDisplay'
import type { BojiMetricScores } from '@coachlink/core/src/bojiInsights'
import { resolveCanvasImageSrc } from '@/utils/weapp-canvas-image'

export const BOJI_POSTER_WIDTH = 750
export const BOJI_POSTER_HEIGHT = 1334
export const BOJI_CARD_WIDTH = 500
export const BOJI_CARD_HEIGHT = 400
const DPR = 2

const INK = '#1E1C1A'
const PAPER = '#F5F2ED'
const MUTED_ON_DARK = '#C9C2B8'
const MUTED = '#6E6860'
const CLAY = '#CF6D4E'
const CLAY_STRONG = '#B4553A'
const CLAY_LIGHT = '#F0A285'
const TRACK_DARK = '#3A3631'
const TRACK = '#E7E1D7'
const FONT = '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'

export interface BojiShareImageData {
  sex: BojiSex
  total: number | null
  percentile: number | null
  lookalikeName: string | null
  lookalikeGroup: string | null
  scores: BojiMetricScores
  nickname: string
  /** 小程序码图片地址（https），拿不到时写文字引导 */
  qrUrl?: string | null
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { weight?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {}
) {
  ctx.font = `${opts.weight ?? 400} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = opts.baseline ?? 'alphabetic'
  ctx.fillText(value, x, y)
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, width: number, fraction: number) {
  ctx.lineCap = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = TRACK_DARK
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (fraction > 0) {
    ctx.strokeStyle = CLAY
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fraction))
    ctx.stroke()
  }
}

function scoreOf(data: BojiShareImageData, key: BojiMetricKey): number | null {
  const v = data.scores[key as keyof BojiMetricScores]
  return typeof v === 'number' ? v : null
}

function fmt(value: number | null): string {
  return value === null ? '—' : String(Math.round(value))
}

async function loadImage(canvas: any, src: string): Promise<any> {
  const local = await resolveCanvasImageSrc(src)
  const image = canvas.createImage()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image load failed'))
    image.src = local
  })
  return image
}

function prepareCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const canvas = ctx.canvas as any
  canvas.width = w * DPR
  canvas.height = h * DPR
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  return canvas
}

/** 写一行字，超出 maxWidth 时逐步缩小字号（不低于 minSize） */
function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color: string,
  opts: { weight?: number; align?: CanvasTextAlign; minSize?: number } = {}
) {
  let current = size
  const min = opts.minSize ?? Math.round(size * 0.6)
  ctx.font = `${opts.weight ?? 400} ${current}px ${FONT}`
  while (current > min && ctx.measureText(value).width > maxWidth) {
    current -= 2
    ctx.font = `${opts.weight ?? 400} ${current}px ${FONT}`
  }
  text(ctx, value, x, y, current, color, { weight: opts.weight, align: opts.align })
}

/**
 * 朋友圈海报 750×1334（2026-10-27 重排）：
 * 深色成绩区（综合分环 + 超越比例 + 最像谁横幅）→ 四项得分 → 底部 PK 小程序码卡片。
 * 先加载小程序码再画；加载失败时底部改成文字引导。
 */
export async function drawBojiPoster(ctx: CanvasRenderingContext2D, data: BojiShareImageData): Promise<void> {
  const W = BOJI_POSTER_WIDTH
  const H = BOJI_POSTER_HEIGHT
  const M = 48
  const canvas = prepareCanvas(ctx, W, H)

  let qr: any = null
  if (data.qrUrl) {
    try {
      qr = await loadImage(canvas, data.qrUrl)
    } catch (error) {
      console.warn('[bojiPoster] qr load failed', error)
    }
  }

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  // 深色成绩区
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, 664)
  text(ctx, '教链 · 薄肌检测器', M, 80, 26, MUTED_ON_DARK)
  fitText(ctx, data.nickname, W - M, 80, 24, 300, MUTED_ON_DARK, { align: 'right' })
  text(ctx, '我的薄肌成绩单', M, 164, 52, PAPER, { weight: 900 })

  ring(ctx, 176, 340, 112, 24, (data.total ?? 0) / 100)
  text(ctx, fmt(data.total), 176, 336, 104, PAPER, { weight: 700, align: 'center', baseline: 'middle' })
  text(ctx, '综合分', 176, 410, 24, MUTED_ON_DARK, { align: 'center' })
  if (data.percentile !== null) {
    text(ctx, '超越了约', 352, 272, 30, MUTED_ON_DARK)
    text(ctx, `${data.percentile}%`, 346, 392, 128, CLAY_LIGHT, { weight: 700 })
    text(ctx, '的人', 352, 444, 30, MUTED_ON_DARK)
  } else {
    text(ctx, '测完来比比', 352, 352, 44, PAPER, { weight: 700 })
  }

  // 最像谁：横幅
  if (data.lookalikeName) {
    fillRounded(ctx, M, 492, W - M * 2, 136, 28, '#2C2925')
    text(ctx, '身材最接近', M + 32, 540, 24, MUTED_ON_DARK)
    fitText(ctx, data.lookalikeName, M + 32, 594, 44, 360, PAPER, { weight: 900 })
    if (data.lookalikeGroup) {
      ctx.font = `700 24px ${FONT}`
      const chipW = ctx.measureText(data.lookalikeGroup).width + 40
      fillRounded(ctx, W - M - 32 - chipW, 536, chipW, 48, 24, CLAY)
      text(ctx, data.lookalikeGroup, W - M - 32 - chipW / 2, 568, 24, '#FFFFFF', { weight: 700, align: 'center' })
    }
  }

  // 四项得分
  text(ctx, '四项得分', M, 724, 30, INK, { weight: 900 })
  let y = 756
  for (const key of bojiDisplayKeys(data.sex)) {
    const score = scoreOf(data, key)
    text(ctx, bojiShortMetricLabel(key, data.sex), M, y + 32, 28, INK)
    fillRounded(ctx, 184, y + 14, 420, 22, 11, TRACK)
    if (score !== null) fillRounded(ctx, 184, y + 14, Math.max(22, (420 * Math.min(100, score)) / 100), 22, 11, CLAY)
    text(ctx, fmt(score), W - M, y + 38, 38, INK, { weight: 700, align: 'right' })
    y += 68
  }

  // PK 小程序码卡片
  const boxH = 236
  const boxY = H - M - boxH
  fillRounded(ctx, M, boxY, W - M * 2, boxH, 40, '#FFFFFF')
  if (qr) {
    ctx.drawImage(qr, M + 24, boxY + 18, 200, 200)
    text(ctx, '敢来 PK 吗？', M + 256, boxY + 92, 44, INK, { weight: 900 })
    text(ctx, '长按识别小程序码', M + 256, boxY + 146, 26, MUTED)
    text(ctx, '测完自动和我逐项比输赢', M + 256, boxY + 186, 26, MUTED)
  } else {
    text(ctx, '敢来 PK 吗？', W / 2, boxY + 104, 44, INK, { weight: 900, align: 'center' })
    text(ctx, '微信搜「教链」小程序 → 工具箱 → 薄肌检测器', W / 2, boxY + 160, 26, MUTED, { align: 'center' })
  }
}

/** 好友卡片 5:4，同步绘制 */
export function drawBojiShareCard(ctx: CanvasRenderingContext2D, data: BojiShareImageData): void {
  const W = BOJI_CARD_WIDTH
  const H = BOJI_CARD_HEIGHT
  prepareCanvas(ctx, W, H)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)
  // 右上角装饰圆环
  ctx.lineWidth = 28
  ctx.strokeStyle = '#2C2925'
  ctx.beginPath()
  ctx.arc(W + 10, -10, 116, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = CLAY
  ctx.beginPath()
  ctx.arc(36, 46, 4, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, '我的薄肌检测结果', 50, 52, 16, MUTED_ON_DARK)

  text(ctx, '综合分', 32, 150, 16, MUTED_ON_DARK)
  text(ctx, fmt(data.total), 28, 272, 132, PAPER, { weight: 700 })
  const right = 236
  if (data.percentile !== null) {
    text(ctx, '超越了约', right, 178, 16, MUTED_ON_DARK)
    text(ctx, `${data.percentile}%`, right - 2, 230, 52, CLAY_LIGHT, { weight: 700 })
  }
  if (data.lookalikeName) text(ctx, `身材最像 ${data.lookalikeName}`, right, 268, 20, PAPER, { weight: 700 })

  // 底部：两项最高分 + 邀请
  const top = bojiDisplayKeys(data.sex)
    .filter((k) => scoreOf(data, k) !== null)
    .sort((a, b) => (scoreOf(data, b) ?? 0) - (scoreOf(data, a) ?? 0))
    .slice(0, 2)
  let x = 32
  for (const key of top) {
    const label = `${bojiShortMetricLabel(key, data.sex)} ${fmt(scoreOf(data, key))}`
    ctx.font = `400 15px ${FONT}`
    const w = ctx.measureText(label).width + 24
    fillRounded(ctx, x, 326, w, 32, 16, TRACK_DARK)
    text(ctx, label, x + 12, 347, 15, PAPER)
    x += w + 8
  }
  fillRounded(ctx, W - 180, 318, 148, 48, 12, CLAY_STRONG)
  text(ctx, '敢来 PK 吗？', W - 106, 349, 20, '#FFFFFF', { weight: 900, align: 'center' })
}
