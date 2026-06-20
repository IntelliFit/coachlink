import { resolveCanvasImageSrc } from '@/utils/weapp-canvas-image'

export interface StreetliftingLocationPosterData {
  name: string
  area: string
  description: string
  imageUrl?: string
  qrCodeUrl?: string
}

const POSTER_WIDTH = 750
const POSTER_HEIGHT = 1100
const POSTER_DPR = 2
const BRAND = '#CF6D4E'
const BRAND_LIGHT = '#FFF4EE'
const BRAND_SOFT = '#F8E5DC'
const INK = '#111827'
const MUTED = '#6B7280'
const SUB = '#9CA3AF'
const WHITE = '#FFFFFF'

/** 小程序 Canvas 安全中文字体栈 */
const FONT_SANS = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif'

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle: string | CanvasGradient
) {
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fillStyle as string
  ctx.fill()
}

function clipRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.clip()
}

function createCanvasImage(canvas: HTMLCanvasElement): any {
  if (typeof (canvas as any).createImage === 'function') {
    return (canvas as any).createImage()
  }
  const wxApi = (typeof wx !== 'undefined' ? wx : null) as any
  if (wxApi?.createImage) {
    return wxApi.createImage()
  }
  if (wxApi?.createOffscreenCanvas) {
    const offscreen = wxApi.createOffscreenCanvas({ type: '2d' })
    if (typeof offscreen?.createImage === 'function') {
      return offscreen.createImage()
    }
  }
  throw new Error('createImage is not available in this environment')
}

async function loadCanvasImage(canvas: HTMLCanvasElement, src: string) {
  const localSrc = await resolveCanvasImageSrc(src)
  const image = createCanvasImage(canvas)
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('canvas image onerror: ' + localSrc))
    image.src = localSrc
  })
  return image
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const anyImage = image as { width?: number; height?: number }
  const sourceWidth = Number(anyImage.width || w)
  const sourceHeight = Number(anyImage.height || h)
  const sourceRatio = sourceWidth / Math.max(sourceHeight, 1)
  const targetRatio = w / Math.max(h, 1)

  let drawWidth = w
  let drawHeight = h
  let drawX = x
  let drawY = y

  if (sourceRatio > targetRatio) {
    drawWidth = h * sourceRatio
    drawX = x - (drawWidth - w) / 2
  } else {
    drawHeight = w / sourceRatio
    drawY = y - (drawHeight - h) / 2
  }

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const normalized = String(text || '').trim()
  if (!normalized) return

  const chars = normalized.split('')
  let current = ''
  let line = 0

  for (let i = 0; i < chars.length; i += 1) {
    const next = current + chars[i]
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }

    if (line === maxLines - 1) {
      let finalLine = current
      while (finalLine.length > 1 && ctx.measureText(`${finalLine}...`).width > maxWidth) {
        finalLine = finalLine.slice(0, -1)
      }
      ctx.fillText(`${finalLine}...`, x, y + line * lineHeight)
      return
    }

    ctx.fillText(current, x, y + line * lineHeight)
    current = chars[i]
    line += 1
  }

  if (current) {
    ctx.fillText(current, x, y + line * lineHeight)
  }
}

export async function drawStreetliftingLocationPoster(
  ctx: CanvasRenderingContext2D,
  data: StreetliftingLocationPosterData
): Promise<{ coverLoaded: boolean; qrLoaded: boolean }> {
  const canvas = ctx.canvas as HTMLCanvasElement
  canvas.width = POSTER_WIDTH * POSTER_DPR
  canvas.height = POSTER_HEIGHT * POSTER_DPR
  ctx.setTransform(POSTER_DPR, 0, 0, POSTER_DPR, 0, 0)

  let coverImage: CanvasImageSource | null = null
  let qrCodeImage: CanvasImageSource | null = null
  let coverLoaded = false
  let qrLoaded = false
  const rawImage = String(data.imageUrl || '').trim()
  const rawQrCode = String(data.qrCodeUrl || '').trim()

  if (rawImage) {
    try {
      coverImage = await loadCanvasImage(canvas, rawImage)
      coverLoaded = true
    } catch (error) {
      console.warn('[drawStreetliftingLocationPoster] cover load failed', error)
      coverImage = null
      coverLoaded = false
    }
  }

  if (rawQrCode) {
    try {
      qrCodeImage = await loadCanvasImage(canvas, rawQrCode)
      qrLoaded = true
    } catch (error) {
      console.warn('[drawStreetliftingLocationPoster] qr code load failed', error)
      qrCodeImage = null
      qrLoaded = false
    }
  }

  /* ========== 背景 ========== */
  const bg = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT)
  bg.addColorStop(0, '#FFF9F5')
  bg.addColorStop(1, '#FFF4EE')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  /* ========== 顶部品牌条 ========== */
  ctx.fillStyle = BRAND
  ctx.font = `500 24px ${FONT_SANS}`
  ctx.fillText('CoachLink · 单杠地图', 48, 68)

  ctx.fillStyle = BRAND_SOFT
  ctx.fillRect(48, 82, 198, 4)

  /* ========== 大图区 ========== */
  const IMAGE_X = 48
  const IMAGE_Y = 110
  const IMAGE_W = 654
  const IMAGE_H = 480
  const IMAGE_R = 32

  fillRoundedRect(ctx, IMAGE_X, IMAGE_Y, IMAGE_W, IMAGE_H, IMAGE_R, '#F5F0EB')

  if (coverImage) {
    ctx.save()
    clipRoundedRect(ctx, IMAGE_X, IMAGE_Y, IMAGE_W, IMAGE_H, IMAGE_R)
    drawImageCover(ctx, coverImage, IMAGE_X, IMAGE_Y, IMAGE_W, IMAGE_H)
    ctx.restore()

    /* 图片底部暗渐变，让标签可读 */
    const shadow = ctx.createLinearGradient(IMAGE_X, IMAGE_Y + IMAGE_H - 120, IMAGE_X, IMAGE_Y + IMAGE_H)
    shadow.addColorStop(0, 'rgba(17,24,39,0)')
    shadow.addColorStop(1, 'rgba(17,24,39,0.40)')
    ctx.fillStyle = shadow
    ctx.fillRect(IMAGE_X, IMAGE_Y + IMAGE_H - 120, IMAGE_W, 120)

    /* 左上角标签 */
    fillRoundedRect(ctx, IMAGE_X + 16, IMAGE_Y + 16, 112, 40, 20, 'rgba(255,255,255,0.88)')
    ctx.fillStyle = BRAND
    ctx.font = `600 18px ${FONT_SANS}`
    ctx.fillText('现场照片', IMAGE_X + 34, IMAGE_Y + 43)
  } else {
    /* 无图占位 */
    const placeholder = ctx.createLinearGradient(IMAGE_X, IMAGE_Y, IMAGE_X + IMAGE_W, IMAGE_Y + IMAGE_H)
    placeholder.addColorStop(0, '#FAE8DF')
    placeholder.addColorStop(1, '#F6F0EA')
    fillRoundedRect(ctx, IMAGE_X, IMAGE_Y, IMAGE_W, IMAGE_H, IMAGE_R, placeholder)

    ctx.fillStyle = BRAND
    ctx.font = `bold 36px ${FONT_SANS}`
    ctx.fillText('暂无现场图片', IMAGE_X + IMAGE_W / 2 - 108, IMAGE_Y + IMAGE_H / 2 - 10)
    ctx.fillStyle = MUTED
    ctx.font = `500 22px ${FONT_SANS}`
    ctx.fillText('打开 CoachLink 可上传现场照片', IMAGE_X + IMAGE_W / 2 - 156, IMAGE_Y + IMAGE_H / 2 + 36)
  }

  /* ========== 信息区 ========== */
  const INFO_Y = 640

  ctx.fillStyle = INK
  ctx.font = `bold 48px ${FONT_SANS}`
  drawMultilineText(ctx, data.name || '单杠点位', 48, INFO_Y, 654, 60, 2)

  const areaY = data.name && data.name.length > 18 ? INFO_Y + 120 : INFO_Y + 64
  ctx.fillStyle = MUTED
  ctx.font = `500 26px ${FONT_SANS}`
  drawMultilineText(ctx, data.area || '打开 CoachLink 查看完整地址', 48, areaY, 654, 40, 2)

  const descY = areaY + (data.area && data.area.length > 28 ? 80 : 48)
  if (data.description) {
    ctx.fillStyle = SUB
    ctx.font = `500 24px ${FONT_SANS}`
    drawMultilineText(ctx, data.description, 48, descY, 654, 38, 2)
  }

  /* ========== 底部行动栏 ========== */
  const FOOTER_Y = 920
  const FOOTER_H = 160
  const FOOTER_R = 32

  fillRoundedRect(ctx, 48, FOOTER_Y, 654, FOOTER_H, FOOTER_R, INK)

  /* 左侧文字 */
  ctx.fillStyle = WHITE
  ctx.font = `bold 30px ${FONT_SANS}`
  ctx.fillText('扫码打开 CoachLink 小程序', 80, FOOTER_Y + 64)

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `500 22px ${FONT_SANS}`
  ctx.fillText('查看地图位置与更多现场图片', 80, FOOTER_Y + 104)

  /* 右侧二维码 */
  const QR_X = 530
  const QR_Y = FOOTER_Y + 16
  const QR_SIZE = 128
  const QR_BG_R = 20

  fillRoundedRect(ctx, QR_X, QR_Y, QR_SIZE, QR_SIZE, QR_BG_R, WHITE)

  if (qrCodeImage) {
    ctx.drawImage(qrCodeImage, QR_X + 8, QR_Y + 8, QR_SIZE - 16, QR_SIZE - 16)
  } else {
    ctx.fillStyle = '#F3F4F6'
    fillRoundedRect(ctx, QR_X + 8, QR_Y + 8, QR_SIZE - 16, QR_SIZE - 16, 16, '#F3F4F6')
    ctx.fillStyle = MUTED
    ctx.font = `500 16px ${FONT_SANS}`
    ctx.fillText('请搜索', QR_X + 36, QR_Y + 60)
    ctx.fillText('CoachLink', QR_X + 24, QR_Y + 84)
  }

  return { coverLoaded, qrLoaded }
}
