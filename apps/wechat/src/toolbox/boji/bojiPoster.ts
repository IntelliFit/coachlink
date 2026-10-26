/**
 * 薄肌检测器的两张分享图（2026-10-26 改版）：
 * - 朋友圈海报 750×1334：成绩 + 四项进度条 + PK 小程序码，保存或用图片菜单直接发朋友圈；
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

/** 朋友圈海报：先重置画布再加载小程序码，加载失败就画文字引导 */
export async function drawBojiPoster(ctx: CanvasRenderingContext2D, data: BojiShareImageData): Promise<void> {
  const W = BOJI_POSTER_WIDTH
  const H = BOJI_POSTER_HEIGHT
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
  ctx.fillRect(0, 0, W, 560)
  text(ctx, '教链 · 薄肌检测器', 48, 84, 26, MUTED_ON_DARK)
  text(ctx, `${data.nickname} 的检测结果`, W - 48, 84, 24, MUTED_ON_DARK, { align: 'right' })
  ring(ctx, 184, 320, 108, 22, (data.total ?? 0) / 100)
  text(ctx, fmt(data.total), 184, 336, 100, PAPER, { weight: 700, align: 'center', baseline: 'middle' })
  text(ctx, '综合分', 184, 404, 24, MUTED_ON_DARK, { align: 'center' })
  if (data.percentile !== null) {
    text(ctx, '超越了约', 360, 262, 30, MUTED_ON_DARK)
    text(ctx, `${data.percentile}%`, 356, 376, 112, CLAY_LIGHT, { weight: 700 })
    text(ctx, '的检测者', 360, 428, 30, MUTED_ON_DARK)
  } else {
    text(ctx, '我的薄肌', 360, 330, 40, PAPER, { weight: 700 })
  }

  // 最像谁
  let y = 640
  if (data.lookalikeName) {
    ctx.fillStyle = CLAY
    ctx.beginPath()
    ctx.arc(104, y + 30, 56, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, data.lookalikeName.slice(0, 1), 104, y + 32, 48, '#FFFFFF', { weight: 900, align: 'center', baseline: 'middle' })
    text(ctx, '身材最接近', 184, y + 6, 24, MUTED)
    const name = data.lookalikeGroup ? `${data.lookalikeName} · ${data.lookalikeGroup}` : data.lookalikeName
    text(ctx, name, 184, y + 62, 42, INK, { weight: 900 })
    y += 140
  }

  // 四项进度条
  for (const key of bojiDisplayKeys(data.sex)) {
    const score = scoreOf(data, key)
    text(ctx, bojiShortMetricLabel(key, data.sex), 48, y + 26, 28, INK)
    fillRounded(ctx, 200, y + 6, 420, 20, 10, TRACK)
    if (score !== null) fillRounded(ctx, 200, y + 6, Math.max(20, (420 * Math.min(100, score)) / 100), 20, 10, CLAY)
    text(ctx, fmt(score), W - 48, y + 30, 36, INK, { weight: 700, align: 'right' })
    y += 72
  }

  // PK 小程序码
  const boxY = H - 254
  fillRounded(ctx, 48, boxY, W - 96, 206, 40, '#FFFFFF')
  if (qr) {
    ctx.drawImage(qr, 76, boxY + 23, 160, 160)
    text(ctx, '敢来 PK 吗？', 268, boxY + 84, 40, INK, { weight: 900 })
    text(ctx, '长按识别小程序码', 268, boxY + 132, 26, MUTED)
    text(ctx, '测完自动和我逐项比', 268, boxY + 172, 26, MUTED)
  } else {
    text(ctx, '敢来 PK 吗？', 84, boxY + 84, 40, INK, { weight: 900 })
    text(ctx, '微信搜「教链」小程序 → 工具箱 → 薄肌检测器', 84, boxY + 140, 26, MUTED)
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
