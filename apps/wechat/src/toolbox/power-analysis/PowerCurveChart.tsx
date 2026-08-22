import { useEffect, useMemo } from 'react'
import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export type PowerCurveMetric = 'displacementM' | 'velocityMps' | 'powerW'

export interface PowerCurvePoint {
  timeS: number
  displacementM: number
  velocityMps: number
  powerW: number
}

interface Props {
  points: PowerCurvePoint[]
  metric: PowerCurveMetric
  comparePoints?: PowerCurvePoint[]
}

const CONFIG: Record<PowerCurveMetric, { label: string; unit: string; color: string }> = {
  displacementM: { label: '位移', unit: 'm', color: '#CF6D4E' },
  velocityMps: { label: '速度', unit: 'm/s', color: '#2563EB' },
  powerW: { label: '功率', unit: 'W', color: '#D97706' }
}

export default function PowerCurveChart({ points, metric, comparePoints }: Props) {
  const canvasId = `power-curve-${metric}`
  const windowWidth = (() => {
    try {
      return Number(Taro.getWindowInfo?.().windowWidth || Taro.getSystemInfoSync().windowWidth || 375)
    } catch {
      return 375
    }
  })()
  const width = Math.max(280, Math.floor(windowWidth - 48))
  const height = 184
  const config = CONFIG[metric]
  const values = useMemo(
    () => points.map((point) => Number(point[metric] || 0)).filter(Number.isFinite),
    [metric, points]
  )
  const compareValues = useMemo(
    () => (comparePoints || []).map((point) => Number(point[metric] || 0)).filter(Number.isFinite),
    [comparePoints, metric]
  )
  const peak = values.length > 0 ? Math.max(...values, 0) : 0
  const comparePeak = compareValues.length > 0 ? Math.max(...compareValues, 0) : 0

  useEffect(() => {
    const context = Taro.createCanvasContext(canvasId)
    const left = 44
    const right = 16
    const top = 20
    const bottom = 34
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const maxValue = Math.max(peak, comparePeak, 1) * 1.08
    const maxTime = Math.max(Number(points[points.length - 1]?.timeS || 0), 1)
    const compareMaxTime = Math.max(Number(comparePoints?.[comparePoints.length - 1]?.timeS || 0), 1)
    const isComparison = Boolean(comparePoints && comparePoints.length > 1)

    context.setFillStyle('#FFFFFF')
    context.fillRect(0, 0, width, height)
    context.setStrokeStyle('#E5E7EB')
    context.setLineWidth(1)
    context.setFontSize(11)
    context.setFillStyle('#6B7280')

    for (let index = 0; index <= 4; index += 1) {
      const y = top + (plotHeight * index) / 4
      context.beginPath()
      context.moveTo(left, y)
      context.lineTo(width - right, y)
      context.stroke()
      const value = maxValue * (1 - index / 4)
      context.fillText(value >= 100 ? value.toFixed(0) : value.toFixed(2), 2, y + 4)
    }

    const drawCurve = (
      curvePoints: PowerCurvePoint[],
      curveMaxTime: number,
      color: string,
      lineWidth: number
    ) => {
      context.setStrokeStyle(color)
      context.setLineWidth(lineWidth)
      context.beginPath()
      curvePoints.forEach((point, index) => {
        const x = left + (Number(point.timeS || 0) / curveMaxTime) * plotWidth
        const value = Math.max(0, Number(point[metric] || 0))
        const y = top + plotHeight - (value / maxValue) * plotHeight
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.stroke()
    }

    if (isComparison && comparePoints) {
      drawCurve(comparePoints, compareMaxTime, '#9CA3AF', 1.5)
    }
    drawCurve(points, maxTime, config.color, 2.5)

    context.setFillStyle('#6B7280')
    context.setFontSize(11)
    context.fillText(isComparison ? '0%' : '0s', left, height - 10)
    context.fillText(isComparison ? '100%' : `${maxTime.toFixed(1)}s`, width - right - 34, height - 10)
    context.draw()
  }, [canvasId, comparePeak, comparePoints, config.color, height, metric, peak, points, width])

  return (
    <View className='power-curve-canvas-wrap'>
      <Canvas
        id={canvasId}
        canvasId={canvasId}
        className='power-curve-canvas'
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      {comparePoints && comparePoints.length > 1 && (
        <View className='power-curve-legend'>
          <View className='power-curve-legend-item'>
            <View className='power-curve-legend-line before' />
            <Text>前测</Text>
          </View>
          <View className='power-curve-legend-item'>
            <View className='power-curve-legend-line after' style={{ background: config.color }} />
            <Text>后测</Text>
          </View>
        </View>
      )}
      <Text className='power-curve-peak'>
        {comparePoints && comparePoints.length > 1
          ? `前测峰值 ${comparePeak >= 100 ? comparePeak.toFixed(0) : comparePeak.toFixed(2)} ${config.unit} · 后测峰值 ${peak >= 100 ? peak.toFixed(0) : peak.toFixed(2)} ${config.unit}`
          : `峰值 ${peak >= 100 ? peak.toFixed(0) : peak.toFixed(2)} ${config.unit}`}
      </Text>
    </View>
  )
}
