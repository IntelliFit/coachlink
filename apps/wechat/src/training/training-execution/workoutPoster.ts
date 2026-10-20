import qrcode from 'qrcode-generator'

import { resolveCanvasImageSrc } from '@/utils/weapp-canvas-image'

import { fitPosterChipText } from './posterSetText'

export const WORKOUT_POSTER_WIDTH = 750
export const WORKOUT_POSTER_MIN_HEIGHT = 1440

const POSTER_DPR = 2
const BRAND = '#CF6D4E'
const INK = '#1F2933'
const MUTED = '#68727D'
const SUBTLE = '#9AA2AA'
const PAPER = '#F6F3EF'
const CARD = '#FFFFFF'
const CHIP = '#F8F5F2'
const LINE = '#ECE7E0'

export interface WorkoutPosterSetRow {
  setNumber: number
  weightText: string
  repsText: string
  recordText?: string
  isPr: boolean
}

export interface WorkoutPosterActionRow {
  id: string
  name: string
  setsCount: number
  volume: number
  sets: WorkoutPosterSetRow[]
}

export interface WorkoutPosterMuscleRow {
  label: string
  score: number
}

export interface WorkoutPosterData {
  dateLabel: string
  nickname: string
  trainingDaysLabel: string
  avatarUrl: string
  title: string
  subtitle: string
  totalVolume: number
  completedSetTotal: number
  durationMin: number
  muscles: WorkoutPosterMuscleRow[]
  actionRows: WorkoutPosterActionRow[]
  frontBodyMap: string
  backBodyMap: string
  frontBodyMapLayers?: string[]
  backBodyMapLayers?: string[]
  shareUrl: string
  shareMode: 'record' | 'brand'
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
) {
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = color
  ctx.fill()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 28
) {
  ctx.save()
  ctx.shadowColor = 'rgba(31, 41, 51, 0.07)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  fillRoundedRect(ctx, x, y, width, height, radius, CARD)
  ctx.restore()
  drawRoundedRect(ctx, x, y, width, height, radius)
  ctx.strokeStyle = 'rgba(31, 41, 51, 0.035)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const text = String(value || '')
  if (ctx.measureText(text).width <= maxWidth) return text
  let current = text
  while (current.length > 1 && ctx.measureText(`${current}…`).width > maxWidth) {
    current = current.slice(0, -1)
  }
  return `${current}…`
}

async function loadPosterImage(canvas: HTMLCanvasElement, src: string): Promise<CanvasImageSource | null> {
  if (!src || typeof (canvas as any).createImage !== 'function') return null
  try {
    const localSrc = await resolveCanvasImageSrc(src)
    const image = (canvas as any).createImage()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('poster image load failed'))
      image.src = localSrc
    })
    return image as CanvasImageSource
  } catch (error) {
    console.warn('[workout-poster] image load failed', error)
    return null
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  nickname: string,
  x: number,
  y: number,
  size: number
) {
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.clip()
  if (image) {
    ctx.drawImage(image, x, y, size, size)
  } else {
    ctx.fillStyle = '#FFF0EA'
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = BRAND
    ctx.font = 'bold 34px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(nickname || '教').slice(0, 1), cx, cy + 1)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 5
  ctx.stroke()
}

function formatNumber(value: number) {
  const rounded = Math.max(0, Math.round(Number(value) || 0))
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: string,
  suffix: string,
  label: string
) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = BRAND
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(value, x, y)
  const valueWidth = ctx.measureText(value).width
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(suffix, x + valueWidth + 8, y + 20)
  ctx.fillStyle = MUTED
  ctx.font = '22px sans-serif'
  ctx.fillText(label, x, y + 58)
}

function drawMuscleTags(
  ctx: CanvasRenderingContext2D,
  muscles: WorkoutPosterMuscleRow[],
  x: number,
  y: number,
  maxWidth: number
) {
  const labels = muscles.length > 0 ? muscles.slice(0, 3).map((item) => item.label) : ['全身']
  let cursorX = x
  labels.forEach((label) => {
    ctx.font = '20px sans-serif'
    const width = Math.min(116, Math.max(72, ctx.measureText(label).width + 42))
    if (cursorX + width > x + maxWidth) return
    fillRoundedRect(ctx, cursorX, y, width, 36, 18, '#FFF0EA')
    ctx.fillStyle = BRAND
    ctx.beginPath()
    ctx.arc(cursorX + 16, y + 18, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#87432E'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cursorX + 28, y + 19)
    cursorX += width + 10
  })
}

function drawSetChip(
  ctx: CanvasRenderingContext2D,
  item: WorkoutPosterSetRow,
  x: number,
  y: number
) {
  const width = 136
  const height = 40
  fillRoundedRect(ctx, x, y, width, height, 16, CHIP)
  ctx.fillStyle = BRAND
  ctx.beginPath()
  ctx.arc(x + 20, y + height / 2, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 17px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(item.setNumber), x + 20, y + height / 2 + 1)

  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  const fitted = fitPosterChipText(
    item.recordText || `${item.weightText}×${item.repsText}`,
    86,
    (value, fontSize) => {
      ctx.font = `${fontSize}px sans-serif`
      return ctx.measureText(value).width
    }
  )
  ctx.font = `${fitted.fontSize}px sans-serif`
  ctx.fillText(fitted.text, x + 42, y + height / 2 + 1)

  if (item.isPr) {
    ctx.fillStyle = BRAND
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('PR', x + width - 8, y + 9)
  }
}

function actionHeight(item: WorkoutPosterActionRow) {
  const setLineCount = Math.max(1, Math.ceil(item.sets.length / 4))
  return 62 + setLineCount * 52 + 18
}

function drawAction(
  ctx: CanvasRenderingContext2D,
  item: WorkoutPosterActionRow,
  x: number,
  y: number,
  width: number
) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = 'bold 25px sans-serif'
  ctx.fillText(fitText(ctx, item.name, width), x, y)

  const chipStartY = y + 46
  item.sets.forEach((set, index) => {
    const row = Math.floor(index / 4)
    const column = index % 4
    drawSetChip(ctx, set, x + column * 148, chipStartY + row * 52)
  })
}

function drawQrCode(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  const quiet = 4
  const cell = size / (count + quiet * 2)

  fillRoundedRect(ctx, x, y, size, size, 16, '#FFFFFF')
  drawRoundedRect(ctx, x, y, size, size, 16)
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = INK
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!qr.isDark(row, column)) continue
      ctx.fillRect(
        x + (column + quiet) * cell,
        y + (row + quiet) * cell,
        Math.ceil(cell),
        Math.ceil(cell)
      )
    }
  }
}

export function formatWorkoutPosterDateLabel(value?: string | number | Date | null) {
  const date = value ? new Date(value) : new Date()
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][safeDate.getDay()]
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')} ${weekday}`
}

export async function drawWorkoutPoster(
  ctx: CanvasRenderingContext2D,
  data: WorkoutPosterData,
  canvas: HTMLCanvasElement
) {
  const displayedActions = data.actionRows.slice(0, 8)
  const hiddenActionCount = Math.max(0, data.actionRows.length - displayedActions.length)
  const qrTarget = String(data.shareUrl || '').trim() || 'https://coachlink.fit'
  const linksToRecord = data.shareMode === 'record' && Boolean(String(data.shareUrl || '').trim())
  const detailHeight =
    104 +
    displayedActions.reduce((sum, item) => sum + actionHeight(item), 0) +
    (hiddenActionCount > 0 ? 42 : 0) +
    24
  const detailTop = 744
  const footerTop = detailTop + detailHeight + 24
  const posterHeight = Math.max(WORKOUT_POSTER_MIN_HEIGHT, footerTop + 208 + 32)

  canvas.width = WORKOUT_POSTER_WIDTH * POSTER_DPR
  canvas.height = posterHeight * POSTER_DPR
  ctx.setTransform(POSTER_DPR, 0, 0, POSTER_DPR, 0, 0)

  const frontLayerSources = data.frontBodyMapLayers || []
  const backLayerSources = data.backBodyMapLayers || []
  const [avatarImage, frontImage, backImage, ...bodyLayerImages] = await Promise.all([
    loadPosterImage(canvas, data.avatarUrl),
    loadPosterImage(canvas, data.frontBodyMap),
    loadPosterImage(canvas, data.backBodyMap),
    ...frontLayerSources.map((src) => loadPosterImage(canvas, src)),
    ...backLayerSources.map((src) => loadPosterImage(canvas, src))
  ])

  // 人体热图是训练分享图的核心内容。真机若无法加载时直接中止生成，
  // 避免继续导出一张看似成功、实际正反人体图为空白的海报。
  if (!frontImage || !backImage || bodyLayerImages.some((image) => !image)) {
    throw new Error('workout body map image unavailable')
  }
  const frontLayerImages = bodyLayerImages.slice(0, frontLayerSources.length) as CanvasImageSource[]
  const backLayerImages = bodyLayerImages.slice(frontLayerSources.length) as CanvasImageSource[]

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WORKOUT_POSTER_WIDTH, posterHeight)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(data.dateLabel, 48, 48)

  drawAvatar(ctx, avatarImage, data.nickname, 48, 104, 88)
  ctx.fillStyle = INK
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(fitText(ctx, data.nickname || '训练者', 420), 160, 116)
  ctx.fillStyle = MUTED
  ctx.font = '24px sans-serif'
  ctx.fillText(data.trainingDaysLabel || '本次训练已完成', 160, 164)

  drawCard(ctx, 32, 224, 686, 496)
  ctx.fillStyle = INK
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(fitText(ctx, data.title || '训练完成', 580), 64, 264)
  ctx.fillStyle = MUTED
  ctx.font = '23px sans-serif'
  ctx.fillText(fitText(ctx, data.subtitle || '训练记录', 580), 64, 316)

  ctx.drawImage(frontImage, 72, 370, 154, 250)
  ctx.drawImage(backImage, 260, 370, 154, 250)
  frontLayerImages.forEach((image) => ctx.drawImage(image, 72, 370, 154, 250))
  backLayerImages.forEach((image) => ctx.drawImage(image, 260, 370, 154, 250))
  ctx.fillStyle = SUBTLE
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('正面', 149, 626)
  ctx.fillText('背面', 337, 626)
  drawMuscleTags(ctx, data.muscles, 72, 664, 350)

  ctx.beginPath()
  ctx.moveTo(460, 356)
  ctx.lineTo(460, 686)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.stroke()

  drawStat(ctx, 496, 370, formatNumber(data.totalVolume), 'kg', '训练总容量')
  drawStat(ctx, 496, 484, formatNumber(data.completedSetTotal), '组', '完成组数')
  drawStat(ctx, 496, 598, formatNumber(data.durationMin), '分钟', '训练时长')

  drawCard(ctx, 32, detailTop, 686, detailHeight)
  fillRoundedRect(ctx, 64, detailTop + 40, 7, 40, 4, BRAND)
  ctx.fillStyle = INK
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('本次训练记录', 88, detailTop + 42)

  let actionY = detailTop + 112
  displayedActions.forEach((item) => {
    drawAction(ctx, item, 72, actionY, 606)
    actionY += actionHeight(item)
  })

  if (hiddenActionCount > 0) {
    ctx.fillStyle = MUTED
    ctx.font = '20px sans-serif'
    ctx.fillText(
      linksToRecord
        ? `另有 ${hiddenActionCount} 个动作，可扫码查看完整记录`
        : `另有 ${hiddenActionCount} 个动作未展示，请在教链查看完整记录`,
      72,
      actionY,
    )
  }

  drawCard(ctx, 32, footerTop, 686, 208)
  const qrX = 64
  const qrY = footerTop + 32
  const qrSize = 144
  drawQrCode(ctx, qrTarget, qrX, qrY, qrSize)

  const footerTextX = 240
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('我在 教链 记录日常训练', footerTextX, footerTop + 50)
  ctx.fillStyle = MUTED
  ctx.font = '21px sans-serif'
  ctx.fillText(linksToRecord ? '长按扫码，查看本次记录' : '长按扫码，进入教链', footerTextX, footerTop + 96)
  ctx.fillStyle = BRAND
  ctx.font = 'bold 25px sans-serif'
  ctx.fillText('教链', footerTextX, footerTop + 138)
  ctx.fillStyle = MUTED
  ctx.font = '21px sans-serif'
  ctx.fillText('CoachLink', footerTextX + 62, footerTop + 141)
}
