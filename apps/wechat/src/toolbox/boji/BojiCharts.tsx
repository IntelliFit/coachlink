import { useEffect } from 'react'
import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { bojiRadarAxes, bojiRingArc } from '@coachlink/core/src/bojiDisplay'
import type { BojiMetricScores } from '@coachlink/core/src/bojiInsights'
import './redesign.scss'

/**
 * 结果页的环形综合分和四项雷达图。小程序 WXML 不支持内联 SVG，用 2d Canvas 画，
 * 文字（分数）仍用 Text，方便适配字体和深色模式。
 */

interface CanvasNode {
  node: any
  width: number
  height: number
}

function queryCanvas(id: string): Promise<CanvasNode | null> {
  return new Promise((resolve) => {
    Taro.createSelectorQuery()
      .select(`#${id}`)
      .fields({ node: true, size: true })
      .exec((res) => resolve(res?.[0]?.node ? (res[0] as CanvasNode) : null))
  })
}

async function withCanvas(id: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const found = await queryCanvas(id)
  if (!found) return
  const { node, width, height } = found
  const dpr = Taro.getSystemInfoSync().pixelRatio || 2
  node.width = Math.round(width * dpr)
  node.height = Math.round(height * dpr)
  const ctx = node.getContext('2d') as CanvasRenderingContext2D
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  draw(ctx, width, height)
}

export interface ChartColors {
  accent: string
  accentStrong: string
  track: string
  grid: string
  label: string
}

export const RING_COLORS_ON_DARK = { accent: '#CF6D4E', track: '#3A3631' }

export function ScoreRing({ id, total, sizeRpx = 272 }: { id: string; total: number | null; sizeRpx?: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      withCanvas(id, (ctx, w, h) => {
        const lineWidth = Math.max(6, w * 0.09)
        const r = Math.min(w, h) / 2 - lineWidth / 2
        const { fraction } = bojiRingArc(total, r)
        ctx.lineCap = 'round'
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = RING_COLORS_ON_DARK.track
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
        ctx.stroke()
        if (fraction > 0) {
          ctx.strokeStyle = RING_COLORS_ON_DARK.accent
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction)
          ctx.stroke()
        }
      }).catch(() => undefined)
    }, 30)
    return () => clearTimeout(timer)
  }, [id, total])

  return (
    <View className='boji-ring' style={{ width: `${sizeRpx}rpx`, height: `${sizeRpx}rpx` }}>
      <Canvas type='2d' id={id} className='boji-ring__canvas' />
      <View className='boji-ring__center'>
        <Text className='boji-ring__value cl-num'>{total === null ? '—' : Math.round(total)}</Text>
        <Text className='boji-ring__label'>综合分</Text>
      </View>
    </View>
  )
}

export function RadarChart({ id, scores, colors }: { id: string; scores: BojiMetricScores; colors: ChartColors }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      withCanvas(id, (ctx, w, h) => {
        const cx = w / 2
        const cy = h / 2
        const radius = Math.min(w, h) / 2 - 44
        ctx.lineWidth = 1
        ctx.strokeStyle = colors.grid
        for (const level of [1, 0.75, 0.5, 0.25]) {
          const axes = bojiRadarAxes({ abs: 100 * level, v_taper: 100 * level, arms: 100 * level, symmetry: 100 * level }, cx, cy, radius)
          ctx.beginPath()
          axes.forEach((a, i) => (i === 0 ? ctx.moveTo(a.point[0], a.point[1]) : ctx.lineTo(a.point[0], a.point[1])))
          ctx.closePath()
          ctx.stroke()
        }
        const axes = bojiRadarAxes(scores, cx, cy, radius)
        ctx.beginPath()
        ctx.moveTo(cx, cy - radius)
        ctx.lineTo(cx, cy + radius)
        ctx.moveTo(cx - radius, cy)
        ctx.lineTo(cx + radius, cy)
        ctx.stroke()

        ctx.beginPath()
        axes.forEach((a, i) => (i === 0 ? ctx.moveTo(a.point[0], a.point[1]) : ctx.lineTo(a.point[0], a.point[1])))
        ctx.closePath()
        ctx.globalAlpha = 0.22
        ctx.fillStyle = colors.accent
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.strokeStyle = colors.accentStrong
        ctx.stroke()

        ctx.font = '700 13px sans-serif'
        ctx.fillStyle = colors.label
        for (const a of axes) {
          ctx.fillStyle = colors.accentStrong
          ctx.beginPath()
          ctx.arc(a.point[0], a.point[1], 3.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = colors.label
          const label = `${a.label === '手臂围度' ? '手臂' : a.label === '左右对称' ? '对称' : a.label} ${a.score === null ? '—' : a.score}`
          const [ex, ey] = a.end
          ctx.textAlign = ex > cx + 1 ? 'left' : ex < cx - 1 ? 'right' : 'center'
          ctx.textBaseline = ey < cy - 1 ? 'bottom' : ey > cy + 1 ? 'top' : 'middle'
          const ox = ex > cx + 1 ? 8 : ex < cx - 1 ? -8 : 0
          const oy = ey < cy - 1 ? -8 : ey > cy + 1 ? 8 : 0
          ctx.fillText(label, ex + ox, ey + oy)
        }
      }).catch(() => undefined)
    }, 30)
    return () => clearTimeout(timer)
  }, [id, scores, colors])

  return <Canvas type='2d' id={id} className='boji-radar' />
}
