import type { MotionArcadeVisualKey } from './gameConfigs'
import {
  CameraCompositeRecorder,
  type CompositeReplayFinalizeProgress,
  type CompositeReplayResult
} from './cameraCompositeRecorder'

export type ArcadeReplayItem = {
  type: 'good' | 'bad'
  x: number
  y: number
  size: number
}

export type ArcadeReplayPlayer = {
  x: number
  y: number
}

export type ArcadeReplayCapture = {
  frameBuffer: Uint8ClampedArray
  frameHeight: number
  frameWidth: number
  items: ArcadeReplayItem[]
  player: ArcadeReplayPlayer
  replayFooterLabel: string
  score: number
  timerMode?: 'elapsed' | 'remaining'
  timeLeftMs: number
  visualKey: MotionArcadeVisualKey
}

export type ArcadeReplayResult = CompositeReplayResult

export type ArcadeReplayFinalizeProgress = CompositeReplayFinalizeProgress

type ReplayPalette = {
  badFill: string
  footerFill: string
  goodFill: string
  hudFill: string
  hudText: string
  playerCoreFill: string
  playerFill: string
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}


function drawRoundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 1
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
  if (strokeStyle) {
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = strokeStyle
    ctx.stroke()
  }
}

function getReplayPalette(): ReplayPalette {
  return {
    badFill: '#27364b',
    footerFill: 'rgba(17, 24, 39, 0.78)',
    goodFill: '#f7c948',
    hudFill: 'rgba(207, 109, 78, 0.96)',
    hudText: '#ffffff',
    playerCoreFill: 'rgba(255, 255, 255, 0.32)',
    playerFill: '#cf6d4e'
  }
}

function drawReplayItem(
  ctx: any,
  item: ArcadeReplayItem,
  width: number,
  height: number,
  palette: ReplayPalette
) {
  const centerX = item.x * width
  const centerY = item.y * height
  const radius = Math.max(8, item.size * width * 0.5)
  const fill = item.type === 'good' ? palette.goodFill : palette.badFill

  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.stroke()
}

function drawPlayer(
  ctx: any,
  player: ArcadeReplayPlayer,
  width: number,
  height: number,
  palette: ReplayPalette
) {
  const playerX = player.x * width
  const playerY = player.y * height

  ctx.beginPath()
  ctx.arc(playerX, playerY, 22, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = palette.playerFill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(playerX, playerY, 10, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = palette.playerCoreFill
  ctx.fill()
}

export class MotionArcadeReplayRecorder extends CameraCompositeRecorder<ArcadeReplayCapture> {
  protected cloneCapture(capture: ArcadeReplayCapture): ArcadeReplayCapture {
    return {
      ...capture,
      frameBuffer: new Uint8ClampedArray(capture.frameBuffer),
      items: capture.items.map((item) => ({ ...item })),
      player: { ...capture.player }
    }
  }

  protected drawOverlay(ctx: any, capture: ArcadeReplayCapture, width: number, height: number) {
    const palette = getReplayPalette()

    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)'
    ctx.fillRect(0, 0, width, height)

    const inset = 16
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)'
    ctx.lineWidth = 2
    drawRoundedRect(
      ctx,
      inset,
      inset,
      width - inset * 2,
      height - inset * 2,
      18,
      'rgba(0, 0, 0, 0)',
      'rgba(255, 255, 255, 0.26)',
      2
    )

    ctx.beginPath()
    ctx.moveTo(inset, height / 2)
    ctx.lineTo(width - inset, height / 2)
    ctx.moveTo(width / 2, inset)
    ctx.lineTo(width / 2, height - inset)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.stroke()

    drawRoundedRect(ctx, 16, 16, 102, 34, 17, 'rgba(255,255,255,0.94)')
    drawRoundedRect(ctx, width - 132, 16, 116, 34, 17, palette.hudFill)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 14px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(`分数 ${capture.score}`, 28, 33)

    ctx.fillStyle = palette.hudText
    ctx.fillText('回放录制中', width - 120, 33)

    capture.items.forEach((item) => {
      drawReplayItem(ctx, item, width, height, palette)
    })

    drawPlayer(ctx, capture.player, width, height, palette)

    drawRoundedRect(ctx, 16, height - 52, 132, 34, 17, palette.footerFill)
    drawRoundedRect(ctx, width - 132, height - 52, 116, 34, 17, palette.footerFill)
    ctx.fillStyle = '#ffffff'
    const timerPrefix = capture.timerMode === 'elapsed' ? '已玩' : '剩余'
    ctx.fillText(`${timerPrefix} ${formatSeconds(capture.timeLeftMs)} 秒`, 28, height - 35)
    ctx.fillText(capture.replayFooterLabel, width - 120, height - 35)
  }
}
