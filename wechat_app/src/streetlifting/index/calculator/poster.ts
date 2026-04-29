/**
 * 力量计算器分享海报：暖白渐变底 + 光运球；主流程同步绘制，避免小程序 Canvas await 后内容丢失。
 */

import Taro from '@tarojs/taro'
import coachlinkLogo from '@/assets/brand/coachlink-logo.jpg'
import coachlinkBrandIcon from '@/assets/brand/coachlink-brand-icon.png'
import { resolveCanvasImageSrc } from '@/utils/weapp-canvas-image'

import qrcode from 'qrcode-generator'

const POSTER_WIDTH = 750
const POSTER_DPR = 2

/** 线上 favicon，分享卡品牌区优先使用 */
const COACHLINK_FAVICON_URL = 'https://coachlink.fit/favicon.jpg'

const COACHLINK_LOGO_PACKAGE_PATHS = [
  '/assets/brand/coachlink-logo.jpg',
  'assets/brand/coachlink-logo.jpg'
]

const BRAND = '#CF6D4E'
const TEXT_INK = '#111827'
const TEXT_MUTED = '#6B7280'
const TEXT_SUB = '#9CA3AF'
/** 右上角时间：略加深，避免「看不见」 */
const TEXT_TIME = 'rgba(90, 96, 110, 0.9)'
const WHITE = '#FFFFFF'
const PILL_TRACK = '#E8EAED'
const QR_URL = 'https://coachlink.fit/?from=streetlifting_share'

const GLYPH_STRENGTH = '\ue605'

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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
  x: number, y: number, w: number, h: number, r: number,
  fillStyle: string
) {
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fillStyle
  ctx.fill()
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  strokeStyle: string,
  lineWidth = 1
) {
  drawRoundedRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawThemeGradientBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#FFFFFF')
  g.addColorStop(0.45, '#FFFBF9')
  g.addColorStop(1, '#FFF5F0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawLightOrbs(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const orbs: Array<{ cx: number; cy: number; r: number; core: string }> = [
    { cx: W * 0.22, cy: H * 0.12, r: 190, core: 'rgba(207, 109, 78, 0.1)' },
    { cx: W * 0.8, cy: H * 0.18, r: 200, core: 'rgba(207, 109, 78, 0.07)' },
    { cx: W * 0.7, cy: H * 0.75, r: 220, core: 'rgba(251, 191, 36, 0.06)' },
    { cx: W * 0.16, cy: H * 0.65, r: 160, core: 'rgba(129, 140, 248, 0.06)' }
  ]
  for (const o of orbs) {
    const rg = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, o.r)
    rg.addColorStop(0, o.core)
    rg.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(o.cx, o.cy, o.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function createQrMatrix(value: string) {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  return qr
}

function drawQrCode(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const qr = createQrMatrix(value)
  const count = qr.getModuleCount()
  const quiet = 4
  const cell = size / (count + quiet * 2)

  fillRoundedRect(ctx, x, y, size, size, 28, WHITE)

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue
      const px = x + (col + quiet) * cell
      const py = y + (row + quiet) * cell
      ctx.fillStyle = TEXT_INK
      ctx.fillRect(px, py, Math.ceil(cell), Math.ceil(cell))
    }
  }
}

/** 与 food_link 一致：resolveCanvasImageSrc + createImage，避免仅 downloadFile 路径在部分基础库下解码失败 */
async function loadCanvasImage(canvas: HTMLCanvasElement, src: string) {
  const localSrc = await resolveCanvasImageSrc(src)
  const image = (canvas as any).createImage()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('canvas image onerror'))
    image.src = localSrc
  })
  return image
}

function resolveImportedAsset(mod: unknown): string {
  if (typeof mod === 'string') return mod
  if (mod && typeof (mod as { default?: string }).default === 'string') return (mod as { default: string }).default
  return ''
}

/** 优先包内品牌图（与线上 favicon 一致），避免依赖 download 合法域名 */
function getCoachlinkLogoCandidates(): string[] {
  const fromLogo = resolveImportedAsset(coachlinkLogo as unknown)
  const fromBrand = resolveImportedAsset(coachlinkBrandIcon as unknown)
  return Array.from(
    new Set(
      [
        fromBrand,
        '/assets/brand/coachlink-brand-icon.png',
        'assets/brand/coachlink-brand-icon.png',
        fromLogo,
        ...COACHLINK_LOGO_PACKAGE_PATHS,
        COACHLINK_FAVICON_URL
      ].filter(Boolean)
    )
  )
}

async function loadCoachlinkLogo(canvas: HTMLCanvasElement) {
  for (const src of getCoachlinkLogoCandidates()) {
    try {
      return await loadCanvasImage(canvas, src)
    } catch (e) {
      console.warn('[loadCoachlinkLogo] candidate failed', src, e)
    }
  }
  return null
}

/** 仅预加载字体，不阻塞主绘制；失败则力量分旁不显示 iconfont */
async function preloadPosterIconFont(): Promise<boolean> {
  const urls = ['/assets/iconfont/iconfont.woff2', '/assets/iconfont/iconfont.ttf']
  for (const u of urls) {
    try {
      await Taro.loadFontFace({
        family: 'PosterIconfont',
        source: `url("${u}")`,
        global: true
      } as Parameters<typeof Taro.loadFontFace>[0])
      return true
    } catch {
      /* next */
    }
  }
  return false
}

export interface StrengthPosterData {
  exerciseName: string
  /** 展示名（头像旁主标题） */
  displayName?: string
  nickname?: string
  /** 头像 URL，支持 https（会先 downloadFile） */
  avatarUrl?: string
  registeredDays?: number
  level: string
  score: number
  scoreLabel: string
  estimated1RM: number
  estimated1RMLabel?: string
  coefficient: number
  workingWeight?: number
  bodyweight: number
  reps: number
  gender: string
  mode: string
  date: string
  submittedAtDisplay?: string
}

/** 布局常量：绘制与高度计算共用（须先于 computeStrengthPosterHeight 定义） */
const STRENGTH_POSTER_LAYOUT = {
  PAD_X: 40,
  PAD_TOP: 48,
  AVATAR: 96,
  /** 头像行与下方文案的间距 */
  GAP_AFTER_AVATAR_ROW: 36,
  META_LINE1: 32,
  META_GAP: 20,
  META_LINE2: 28,
  /** 主数据段前留白（核心呼吸区） */
  GAP_BEFORE_SCORE: 56,
  SCORE_ROW_H: 136,
  GAP_AFTER_SCORE: 40,
  LEVEL_H: 52,
  GAP_LEVEL_TO_SUB: 16,
  SUBTITLE_H: 32,
  /** 四宫格与上方主分组的间距 */
  GAP_BEFORE_METRICS: 48,
  METRIC_CARD_H: 184,
  METRIC_GAP_Y: 28,
  METRIC_GAP_X: 24,
  GAP_BEFORE_FOOTER: 48,
  FOOTER_BAND: 212,
  get totalHeight() {
    return (
      this.PAD_TOP +
      this.AVATAR +
      this.GAP_AFTER_AVATAR_ROW +
      this.META_LINE1 +
      this.META_GAP +
      this.META_LINE2 +
      this.GAP_BEFORE_SCORE +
      this.SCORE_ROW_H +
      this.GAP_AFTER_SCORE +
      this.LEVEL_H +
      this.GAP_LEVEL_TO_SUB +
      this.SUBTITLE_H +
      this.GAP_BEFORE_METRICS +
      this.METRIC_CARD_H * 2 +
      this.METRIC_GAP_Y +
      this.GAP_BEFORE_FOOTER +
      this.FOOTER_BAND
    )
  }
} as const

/**
 * 海报总高：与 drawPosterBodySync 自上而下累加一致（禁止再用「剩余空间垂直居中」把主内容挤成一团）。
 */
export function computeStrengthPosterHeight(_data: StrengthPosterData): number {
  return STRENGTH_POSTER_LAYOUT.totalHeight
}

/** 与离屏 Canvas style、导出高度一致（px，逻辑宽 750） */
export const STRENGTH_POSTER_DISPLAY_HEIGHT = STRENGTH_POSTER_LAYOUT.totalHeight

const METRIC_CARD_H = STRENGTH_POSTER_LAYOUT.METRIC_CARD_H
const METRIC_GAP_X = STRENGTH_POSTER_LAYOUT.METRIC_GAP_X
const METRIC_GAP_Y = STRENGTH_POSTER_LAYOUT.METRIC_GAP_Y

/** 右侧迷你柱组（主题色 + 淡色「倒影」条，增强层次感） */
function drawMiniBarCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number
) {
  const n = 5
  const gap = 4
  const barW = Math.max(4, (w - gap * (n - 1)) / n)
  const floorY = y + h
  for (let i = 0; i < n; i += 1) {
    const rnd = (Math.sin(seed * 0.002 + i * 1.7) + 1) / 2
    const bh = h * (0.32 + rnd * 0.68)
    const bx = x + i * (barW + gap)
    const by = floorY - bh
    ctx.fillStyle = BRAND
    ctx.globalAlpha = 0.92
    fillRoundedRect(ctx, bx, by, barW, bh, Math.min(4, barW / 2))
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(207, 109, 78, 0.14)'
    const refH = Math.min(10, bh * 0.28)
    fillRoundedRect(ctx, bx, floorY + 3, barW, refH, 2)
  }
}

/** 横向进度装饰（轨道灰 + 主题色填充） */
function drawDecorProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number
) {
  const k = Math.min(1, Math.max(0, t))
  fillRoundedRect(ctx, x, y, w, h, h / 2, PILL_TRACK)
  const fillW = Math.max(h, w * k)
  fillRoundedRect(ctx, x, y, fillW, h, h / 2, BRAND)
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  valueMain: string,
  valueSuffix: string | undefined,
  decor: { kind: 'bars' | 'progress'; t: number; seed: number }
) {
  const r = 28
  fillRoundedRect(ctx, x, y, w, h, r, '#EEF1F6')
  strokeRoundedRect(ctx, x, y, w, h, r, 'rgba(17, 24, 39, 0.06)', 1)

  const pad = 24
  const decorW = 88
  const decorH = 76
  const decorX = x + w - pad - decorW
  const decorY = y + pad

  if (decor.kind === 'bars') {
    drawMiniBarCluster(ctx, decorX, decorY, decorW, decorH, decor.seed)
  } else {
    const barH = 12
    drawDecorProgressBar(ctx, decorX, decorY + decorH / 2 - barH / 2, decorW, barH, decor.t)
  }

  const textMax = w - pad * 2 - decorW - 16
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT_MUTED
  ctx.font = '20px sans-serif'
  let labelDraw = label
  while (labelDraw.length > 1 && ctx.measureText(labelDraw).width > textMax) {
    labelDraw = `${labelDraw.slice(0, -2)}…`
  }
  ctx.fillText(labelDraw, x + pad, y + pad)

  const valY = y + pad + 34
  ctx.fillStyle = TEXT_INK
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(valueMain, x + pad, valY)
  const mainW = ctx.measureText(valueMain).width
  if (valueSuffix) {
    ctx.font = 'bold 24px sans-serif'
    ctx.fillStyle = BRAND
    ctx.fillText(valueSuffix, x + pad + mainW + 10, valY + 16)
  }
}

function drawAvatarPlaceholder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  letter: string
) {
  ctx.fillStyle = '#F3F4F6'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(17, 24, 39, 0.06)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = TEXT_SUB
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter.slice(0, 1).toUpperCase(), cx, cy + 1)
}

/**
 * 同步绘制主体：自上而下排版，主数据段间距与 computeStrengthPosterHeight 一致。
 */
function drawPosterBodySync(
  ctx: CanvasRenderingContext2D,
  data: StrengthPosterData,
  W: number,
  H: number,
  hasIconFont: boolean,
  avatarImg: CanvasImageSource | null
): { footerY: number; logoX: number; logoY: number; logoBox: number } {
  const L = STRENGTH_POSTER_LAYOUT
  const PAD = L.PAD_X
  const FOOTER_BAND = L.FOOTER_BAND
  const footerTop = H - FOOTER_BAND
  const scoreStr = data.score.toFixed(data.scoreLabel === 'DOTS 分' ? 1 : 0)
  const safeNickname = String(data.nickname || '').trim() || 'CoachLink 用户'
  const handleRaw = safeNickname.replace(/^@/, '')
  const displayName = String(data.displayName || handleRaw).trim() || 'CoachLink 用户'
  const userTag = `@${handleRaw}`
  const joinedDays = Math.max(1, Number(data.registeredDays || 1))
  const timeStr = String(data.submittedAtDisplay || data.date || '').trim()
  const accentLabel = data.scoreLabel === 'DOTS 分' ? '下肢综合表现' : '上肢街健表现'
  const levelClean = data.level.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim()

  const AV = L.AVATAR
  const avX = PAD
  const avY = L.PAD_TOP
  const cx = avX + AV / 2
  const cy = avY + AV / 2

  if (avatarImg) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatarImg, avX, avY, AV, AV)
    ctx.restore()
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.08)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    drawAvatarPlaceholder(ctx, cx, cy, AV / 2, displayName)
  }

  const textColX = avX + AV + 16
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = TEXT_INK
  ctx.font = 'bold 30px sans-serif'
  let nameDraw = displayName
  const nameMax = W - PAD - 220 - textColX
  while (nameDraw.length > 1 && ctx.measureText(nameDraw).width > nameMax) {
    nameDraw = `${nameDraw.slice(0, -2)}…`
  }
  ctx.fillText(nameDraw, textColX, avY + 6)

  ctx.fillStyle = TEXT_SUB
  ctx.font = '22px sans-serif'
  let tagDraw = userTag
  const tagMaxW = W - PAD - 200 - textColX
  while (tagDraw.length > 2 && ctx.measureText(tagDraw).width > tagMaxW) {
    tagDraw = `${tagDraw.slice(0, -2)}…`
  }
  ctx.fillText(tagDraw, textColX, avY + 46)

  ctx.textAlign = 'right'
  ctx.fillStyle = TEXT_TIME
  ctx.font = '400 20px sans-serif'
  ctx.fillText(timeStr, W - PAD, avY + 10)

  /** 元信息区（与头像行拉开，避免贴顶） */
  let y = avY + AV + L.GAP_AFTER_AVATAR_ROW
  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT_MUTED
  ctx.font = '24px sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(`已加入 CoachLink ${joinedDays} 天`, W / 2, y)

  y += L.META_LINE1 + L.META_GAP
  ctx.fillStyle = TEXT_SUB
  ctx.font = '22px sans-serif'
  ctx.fillText(accentLabel, W / 2, y)

  /** 主数据段：大分 + 等级 + 副标题（自上而下，不再在剩余高度内垂直居中） */
  y += L.META_LINE2 + L.GAP_BEFORE_SCORE
  const scoreRowTop = y
  const scoreBlockCenterY = scoreRowTop + L.SCORE_ROW_H / 2

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = 'bold 112px sans-serif'
  const scoreW = ctx.measureText(scoreStr).width
  let iconAdvance = 0
  if (hasIconFont) {
    ctx.font = '76px PosterIconfont'
    try {
      iconAdvance = ctx.measureText(GLYPH_STRENGTH).width + 12
    } catch {
      iconAdvance = 0
    }
  }
  const totalW = iconAdvance + scoreW
  const startX = (W - totalW) / 2
  if (hasIconFont && iconAdvance > 0) {
    ctx.fillStyle = BRAND
    ctx.font = '76px PosterIconfont'
    ctx.fillText(GLYPH_STRENGTH, startX, scoreBlockCenterY)
  }
  ctx.fillStyle = BRAND
  ctx.font = 'bold 112px sans-serif'
  ctx.fillText(scoreStr, startX + iconAdvance, scoreBlockCenterY)

  y = scoreRowTop + L.SCORE_ROW_H + L.GAP_AFTER_SCORE
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT_INK
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(levelClean, W / 2, y)

  y += L.LEVEL_H + L.GAP_LEVEL_TO_SUB
  ctx.fillStyle = TEXT_MUTED
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`${data.scoreLabel} · ${data.exerciseName}`, W / 2, y)

  y += L.SUBTITLE_H + L.GAP_BEFORE_METRICS
  const rmLabel = data.estimated1RMLabel?.trim() || '估算 1RM'
  const tRm = Math.min(1, data.estimated1RM / 320)
  const workingWeight =
    typeof data.workingWeight === 'number' && Number.isFinite(data.workingWeight)
      ? data.workingWeight
      : null
  const tCoeff = Math.min(1, data.coefficient / 5)
  const tWorkingWeight = Math.min(1, Math.max(0, (workingWeight ?? 0) / 200))
  const tBw = Math.min(1, data.bodyweight / 140)
  const tReps = Math.min(1, data.reps / 35)
  const formatMetricNumber = (value: number, decimals = 1) => {
    const fixed = value.toFixed(decimals)
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  }

  const cardW = Math.floor((W - PAD * 2 - METRIC_GAP_X) / 2)
  const metrics: Array<{
    label: string
    main: string
    suffix?: string
    decor: { kind: 'bars' | 'progress'; t: number; seed: number }
  }> = [
    {
      label: rmLabel,
      main: data.estimated1RM.toFixed(1),
      suffix: 'kg',
      decor: { kind: 'bars', t: tRm, seed: Math.floor(data.estimated1RM * 1000 + data.bodyweight) }
    },
    {
      label: '力量系数',
      main: data.coefficient.toFixed(3),
      decor: { kind: 'progress', t: tCoeff, seed: Math.floor(data.coefficient * 100000) }
    },
    {
      label: '体重',
      main: String(data.bodyweight),
      suffix: 'kg',
      decor: { kind: 'bars', t: tBw, seed: Math.floor(data.bodyweight * 99 + 17) }
    },
    {
      label: '做组次数',
      main: String(data.reps),
      suffix: '次',
      decor: { kind: 'progress', t: tReps, seed: Math.floor(Number(data.reps) * 131) }
    }
  ]

  if (workingWeight !== null) {
    metrics[1] = {
      label: '鍋氱粍閲嶉噺',
      main: formatMetricNumber(workingWeight, 1),
      suffix: 'kg',
      decor: { kind: 'progress', t: tWorkingWeight, seed: Math.floor(workingWeight * 1000 + data.reps) }
    }
  }
  metrics[2] = {
    ...metrics[2],
    main: formatMetricNumber(data.bodyweight, 1)
  }

  metrics.forEach((m, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = PAD + col * (cardW + METRIC_GAP_X)
    const cy = y + row * (METRIC_CARD_H + METRIC_GAP_Y)
    drawMetricCard(ctx, cx, cy, cardW, METRIC_CARD_H, m.label, m.main, m.suffix, m.decor)
  })

  const logoBox = 72
  const logoX = PAD
  const logoY = footerTop + 20
  fillRoundedRect(ctx, logoX, logoY, logoBox, logoBox, 16, 'rgba(207, 109, 78, 0.08)')
  ctx.fillStyle = BRAND
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('CL', logoX + logoBox / 2, logoY + logoBox / 2 + 2)
  strokeRoundedRect(ctx, logoX, logoY, logoBox, logoBox, 16, 'rgba(17, 24, 39, 0.06)', 1)

  const textLeft = logoX + logoBox + 16
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT_INK
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('CoachLink 启能教练', textLeft, logoY + 6)

  ctx.fillStyle = TEXT_MUTED
  ctx.font = '17px sans-serif'
  ctx.fillText('记录你的力量成绩，分享你的训练成长。', textLeft, logoY + 44)
  ctx.fillText('扫码进入 CoachLink，测测你的力量水平。', textLeft, logoY + 66)

  const qrSize = 112
  const qrX = W - PAD - qrSize
  const qrY = logoY
  drawQrCode(ctx, QR_URL, qrX, qrY, qrSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT_MUTED
  ctx.font = '16px sans-serif'
  ctx.fillText('扫码查看', qrX + qrSize / 2, qrY + qrSize + 8)

  return { footerY: logoY, logoX, logoY, logoBox }
}

/** 仅异步：预加载字体 + Logo 盖在占位上 */
async function drawPosterLogoAsync(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layout: { footerY: number; logoX: number; logoY: number; logoBox: number }
) {
  const { footerY, logoX, logoY, logoBox } = layout

  try {
    const logoImg = await loadCoachlinkLogo(canvas)
    if (logoImg) {
      const lr = Math.min(16, logoBox / 2)
      fillRoundedRect(ctx, logoX, logoY, logoBox, logoBox, lr, 'rgba(207, 109, 78, 0.08)')
      ctx.save()
      drawRoundedRect(ctx, logoX, logoY, logoBox, logoBox, lr)
      ctx.clip()
      ctx.drawImage(logoImg, logoX, logoY, logoBox, logoBox)
      ctx.restore()
      strokeRoundedRect(ctx, logoX, logoY, logoBox, logoBox, lr, 'rgba(17, 24, 39, 0.06)', 1)
    }
  } catch {
    /* 保留同步阶段 CL 占位 */
  }
}

export function drawStrengthPoster(
  ctx: CanvasRenderingContext2D,
  data: StrengthPosterData
): Promise<void> {
  const W = POSTER_WIDTH
  const H = computeStrengthPosterHeight(data)
  const canvas = ctx.canvas as any

  return (async () => {
    let hasIconFont = false
    try {
      hasIconFont = await preloadPosterIconFont()
    } catch {
      hasIconFont = false
    }

    /** 先重置画布尺寸，再 createImage / decode，避免部分机型首帧解码失败 */
    canvas.width = W * POSTER_DPR
    canvas.height = H * POSTER_DPR
    ctx.setTransform(POSTER_DPR, 0, 0, POSTER_DPR, 0, 0)

    let avatarImg: CanvasImageSource | null = null
    const rawAvatar = String(data.avatarUrl || '').trim()
    if (rawAvatar) {
      try {
        avatarImg = await loadCanvasImage(canvas, rawAvatar)
      } catch (e) {
        console.warn('[drawStrengthPoster] avatar load failed', e)
        avatarImg = null
      }
    }

    drawThemeGradientBg(ctx, W, H)
    drawLightOrbs(ctx, W, H)

    const layout = drawPosterBodySync(ctx, data, W, H, hasIconFont, avatarImg)

    try {
      await drawPosterLogoAsync(ctx, canvas, layout)
    } catch (e) {
      console.warn('[drawStrengthPoster] brand logo failed', e)
    }
  })()
}

export { POSTER_WIDTH }
