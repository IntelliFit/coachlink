import { useMemo } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export interface PowerCurvePoint {
  timeS: number
  displacementM: number
  velocityMps: number
  powerW: number
}

type PowerCurveMetric = 'velocityMps' | 'powerW'

interface Props {
  points: PowerCurvePoint[]
  metric: PowerCurveMetric
  comparePoints?: PowerCurvePoint[]
}

interface PlotPoint {
  x: number
  y: number
}

interface CurveSegment {
  left: number
  top: number
  length: number
  angle: number
}

const CONFIG: Record<PowerCurveMetric, { label: string; unit: string; color: string }> = {
  velocityMps: { label: '速度', unit: 'm/s', color: '#2563EB' },
  powerW: { label: '功率', unit: 'W', color: '#D97706' }
}

const MAX_RENDERED_POINTS = 120

function getChartWidth() {
  try {
    const windowWidth = Number(Taro.getWindowInfo?.().windowWidth || Taro.getSystemInfoSync().windowWidth || 375)
    return Math.max(272, Math.floor(windowWidth - 64))
  } catch {
    return 311
  }
}

function finiteCurvePoints(points: PowerCurvePoint[], metric: PowerCurveMetric) {
  return points.filter((point) => (
    Number.isFinite(Number(point.timeS)) && Number.isFinite(Number(point[metric]))
  ))
}

function downsamplePreservingExtremes(points: PowerCurvePoint[], metric: PowerCurveMetric) {
  if (points.length <= MAX_RENDERED_POINTS) return points

  const first = points[0]
  const last = points[points.length - 1]
  const interior = points.slice(1, -1)
  const bucketCount = Math.max(1, Math.floor((MAX_RENDERED_POINTS - 2) / 2))
  const bucketSize = Math.max(1, Math.ceil(interior.length / bucketCount))
  const sampled: PowerCurvePoint[] = [first]

  for (let start = 0; start < interior.length; start += bucketSize) {
    const bucket = interior.slice(start, start + bucketSize)
    if (bucket.length === 0) continue

    let minIndex = 0
    let maxIndex = 0
    for (let index = 1; index < bucket.length; index += 1) {
      if (Number(bucket[index][metric]) < Number(bucket[minIndex][metric])) minIndex = index
      if (Number(bucket[index][metric]) > Number(bucket[maxIndex][metric])) maxIndex = index
    }

    const selectedIndices = Array.from(new Set([minIndex, maxIndex])).sort((a, b) => a - b)
    selectedIndices.forEach((index) => sampled.push(bucket[index]))
  }

  sampled.push(last)
  return sampled
}

function buildPlotPoints(params: {
  points: PowerCurvePoint[]
  metric: PowerCurveMetric
  maxTime: number
  maxValue: number
  left: number
  top: number
  plotWidth: number
  plotHeight: number
}) {
  const sampled = downsamplePreservingExtremes(
    finiteCurvePoints(params.points, params.metric),
    params.metric
  )

  return sampled.map((point) => ({
    x: params.left + (Math.max(0, Number(point.timeS || 0)) / params.maxTime) * params.plotWidth,
    y: params.top + params.plotHeight - (
      Math.max(0, Number(point[params.metric] || 0)) / params.maxValue
    ) * params.plotHeight
  }))
}

function buildSegments(points: PlotPoint[]): CurveSegment[] {
  const segments: CurveSegment[] = []
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const deltaX = current.x - previous.x
    const deltaY = current.y - previous.y
    const length = Math.hypot(deltaX, deltaY)
    if (!Number.isFinite(length) || length <= 0) continue
    segments.push({
      left: previous.x,
      top: previous.y,
      length,
      angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI
    })
  }
  return segments
}

export default function PowerCurveChart({ points, metric, comparePoints }: Props) {
  const height = 184
  const chartWidth = getChartWidth()
  const config = CONFIG[metric]
  const values = useMemo(
    () => finiteCurvePoints(points, metric).map((point) => Math.max(0, Number(point[metric] || 0))),
    [metric, points]
  )
  const compareValues = useMemo(
    () => finiteCurvePoints(comparePoints || [], metric).map((point) => Math.max(0, Number(point[metric] || 0))),
    [comparePoints, metric]
  )
  const peak = values.length > 0 ? Math.max(...values, 0) : 0
  const comparePeak = compareValues.length > 0 ? Math.max(...compareValues, 0) : 0
  const isComparison = Boolean(comparePoints && comparePoints.length > 1)

  const chart = useMemo(() => {
    const left = 44
    const right = 16
    const top = 20
    const bottom = 34
    const plotWidth = Math.max(1, chartWidth - left - right)
    const plotHeight = Math.max(1, height - top - bottom)
    const maxValue = Math.max(peak, comparePeak, 1) * 1.08
    const maxTime = Math.max(Number(points[points.length - 1]?.timeS || 0), 1)
    const compareMaxTime = Math.max(Number(comparePoints?.[comparePoints.length - 1]?.timeS || 0), 1)
    const currentPlotPoints = buildPlotPoints({
      points,
      metric,
      maxTime,
      maxValue,
      left,
      top,
      plotWidth,
      plotHeight
    })
    const comparisonPlotPoints = comparePoints
      ? buildPlotPoints({
          points: comparePoints,
          metric,
          maxTime: compareMaxTime,
          maxValue,
          left,
          top,
          plotWidth,
          plotHeight
        })
      : []

    return {
      left,
      right,
      top,
      bottom,
      plotWidth,
      plotHeight,
      maxValue,
      maxTime,
      currentSegments: buildSegments(currentPlotPoints),
      comparisonSegments: buildSegments(comparisonPlotPoints)
    }
  }, [chartWidth, comparePeak, comparePoints, height, metric, peak, points])

  return (
    <View className='power-curve-canvas-wrap'>
      <View
        className='power-curve-view-chart'
        style={{ width: `${chartWidth}px`, height: `${height}px` }}
      >
        {[0, 1, 2, 3, 4].map((index) => {
          const y = chart.top + (chart.plotHeight * index) / 4
          const value = chart.maxValue * (1 - index / 4)
          return (
            <View key={`grid-${index}`}>
              <Text
                className='power-curve-axis-label power-curve-axis-label-y'
                style={{ top: `${y - 7}px`, width: `${chart.left - 4}px` }}
              >
                {value >= 100 ? value.toFixed(0) : value.toFixed(2)}
              </Text>
              <View
                className='power-curve-grid-line'
                style={{
                  left: `${chart.left}px`,
                  top: `${y}px`,
                  width: `${chart.plotWidth}px`
                }}
              />
            </View>
          )
        })}

        {isComparison && chart.comparisonSegments.map((segment, index) => (
          <View
            key={`before-${index}`}
            className='power-curve-view-segment'
            style={{
              left: `${segment.left}px`,
              top: `${segment.top}px`,
              width: `${segment.length}px`,
              borderTopColor: '#9CA3AF',
              borderTopWidth: '1.5px',
              transform: `rotate(${segment.angle}deg)`
            }}
          />
        ))}

        {chart.currentSegments.map((segment, index) => (
          <View
            key={`current-${index}`}
            className='power-curve-view-segment'
            style={{
              left: `${segment.left}px`,
              top: `${segment.top}px`,
              width: `${segment.length}px`,
              borderTopColor: config.color,
              borderTopWidth: '2.5px',
              transform: `rotate(${segment.angle}deg)`
            }}
          />
        ))}

        <Text
          className='power-curve-axis-label power-curve-axis-label-x'
          style={{ left: `${chart.left}px`, top: `${height - 24}px` }}
        >
          {isComparison ? '0%' : '0s'}
        </Text>
        <Text
          className='power-curve-axis-label power-curve-axis-label-x power-curve-axis-label-x-end'
          style={{ right: `${chart.right}px`, top: `${height - 24}px` }}
        >
          {isComparison ? '100%' : `${chart.maxTime.toFixed(1)}s`}
        </Text>
      </View>

      {isComparison && (
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
        {isComparison
          ? `前测瞬时峰值 ${comparePeak >= 100 ? comparePeak.toFixed(0) : comparePeak.toFixed(2)} ${config.unit} · 后测瞬时峰值 ${peak >= 100 ? peak.toFixed(0) : peak.toFixed(2)} ${config.unit}`
          : `瞬时峰值 ${peak >= 100 ? peak.toFixed(0) : peak.toFixed(2)} ${config.unit}`}
      </Text>
    </View>
  )
}
