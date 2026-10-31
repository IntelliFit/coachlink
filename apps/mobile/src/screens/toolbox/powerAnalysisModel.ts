import { isBarbellPowerAnalysisMode, isCustomPowerAnalysisMode, type PowerAnalysisMode } from '@coachlink/core/src/powerAnalysisModes'
import type { PowerAnalysisJobStatus } from '@coachlink/core/src/powerAnalysisJobs'

/**
 * 功率分析结果的展示和对比规则，与小程序 toolbox/power-analysis 一致。
 */

export type PowerAnalysisQuality = 'compressed' | 'original'
export type OverlayLanguage = 'zh' | 'en'

export type PowerAnalysisRepMetric = {
  repIndex: number
  displacementM: number
  ascentTimeS: number
  avgPowerW: number
  horsepowerHp: number
  maxVelocityMps: number
  meanVelocityMps?: number
  pauseS?: number | null
  phase1TimeS?: number
  phase2TimeS?: number
  holdTimeS?: number
  jointMinDeg?: number
  jointMaxDeg?: number
}

export type PowerAnalysisCheckStatus = 'good' | 'info' | 'warn' | 'issue' | 'unavailable'

export type PowerAnalysisAssessment = {
  version: string
  view: 'front' | 'side' | 'oblique' | 'unknown'
  viewLabelZh: string
  recommendedViewZh: string
  counts: Record<PowerAnalysisCheckStatus, number>
  checks: Array<{ code: string; titleZh: string; status: PowerAnalysisCheckStatus; detailZh: string; repIndexes: number[]; timesS: number[]; value: number | null; unit: string }>
}

export type PowerAnalysisMeasurement = {
  target: 'body_anchor' | 'barbell_plate' | 'barbell_body_proxy'
  anchorLabelZh: string
  scaleSource: string
  confidence: 'high' | 'medium' | 'low'
  plateDiameterCm?: number
  trackingCoverage?: number
  warningsZh: string[]
}

export type PowerAnalysisMetrics = {
  mode: PowerAnalysisMode
  mass?: { bodyWeightKg: number; externalLoadKg: number; effectiveMassKg: number }
  repCount: number
  summary: {
    avgPowerW: number
    bestPowerW: number
    bestHorsepowerHp: number
    bestVelocityMps: number
    avgAscentTimeS: number
    avgDisplacementM: number
    bestMeanVelocityMps?: number
    avgMeanVelocityMps?: number
    velocityLossPct?: number | null
  }
  reps: PowerAnalysisRepMetric[]
  assessment?: PowerAnalysisAssessment
  measurement?: PowerAnalysisMeasurement
  custom?: { actionNameZh: string; primaryPartZh: string; phaseLabelsZh: [string, string]; mainJointZh: string | null }
  timeSeries?: Array<{ timeS: number; displacementM: number; velocityMps: number; powerW: number }>
  rating?: { level?: string; normalizedPowerWPerKg: number; labelZh: string; labelEn?: string; descriptionZh: string }
  video?: { inputHasAudio?: boolean; audioPreserved?: boolean; quality?: PowerAnalysisQuality }
  notes?: string[]
}

export type PowerAnalysisRankingMetric = { rank: number; participantTotal: number; percentile: number; bestValue: number; isPersonalBest: boolean }

export type PowerAnalysisJobDto = {
  id: string
  mode: PowerAnalysisMode
  heightCm: number
  weightKg: number
  externalLoadKg: number
  plateDiameterCm?: number
  customActionName?: string
  status: PowerAnalysisJobStatus
  progress: number
  metrics: PowerAnalysisMetrics | null
  llmSummary: string | null
  errorMessage: string | null
  expiresAt: string
  createdAt: string
  completedAt: string | null
  canDownload: boolean
  quality?: PowerAnalysisQuality
  overlayLanguage?: OverlayLanguage
  queueInfo?: { jobsAhead: number; queuedAhead: number; processingAhead: number; totalQueued: number } | null
  ranking?: { scope: string; scopeLabel: string; power: PowerAnalysisRankingMetric; speed: PowerAnalysisRankingMetric } | null
}

export type PowerComparisonRow = { key: string; label: string; before: number; after: number; unit: string; digits: number; higherIsBetter: boolean }

export function formatPowerMetric(value: number | null | undefined, digits = 1) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toFixed(digits) : '0'
}

function averageOf(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0
}

export function buildPowerComparisonRows(before: PowerAnalysisMetrics, after: PowerAnalysisMetrics): PowerComparisonRow[] {
  if (isCustomPowerAnalysisMode(before.mode) || isCustomPowerAnalysisMode(after.mode)) {
    return [
      { key: 'repCount', label: '有效次数', before: before.repCount, after: after.repCount, unit: '次', digits: 0, higherIsBetter: true },
      { key: 'avgDisplacementM', label: '平均幅度', before: Number(before.summary.avgDisplacementM || 0) * 100, after: Number(after.summary.avgDisplacementM || 0) * 100, unit: 'cm', digits: 0, higherIsBetter: true },
    ]
  }
  // 杠铃看平均速度；自重动作保持原来四行
  const bothBarbell = isBarbellPowerAnalysisMode(before.mode) && isBarbellPowerAnalysisMode(after.mode)
  const meanVelocityRows: PowerComparisonRow[] = bothBarbell && typeof before.summary.bestMeanVelocityMps === 'number' && typeof after.summary.bestMeanVelocityMps === 'number'
    ? [{ key: 'bestMeanVelocityMps', label: '最佳平均速度', before: before.summary.bestMeanVelocityMps, after: after.summary.bestMeanVelocityMps, unit: 'm/s', digits: 2, higherIsBetter: true }]
    : []
  return [
    ...meanVelocityRows,
    { key: 'bestPowerW', label: '最高功率', before: Number(before.summary.bestPowerW || 0), after: Number(after.summary.bestPowerW || 0), unit: 'W', digits: 0, higherIsBetter: true },
    { key: 'avgPowerW', label: '平均功率', before: Number(before.summary.avgPowerW || 0), after: Number(after.summary.avgPowerW || 0), unit: 'W', digits: 0, higherIsBetter: true },
    { key: 'bestVelocityMps', label: '最快速度', before: Number(before.summary.bestVelocityMps || 0), after: Number(after.summary.bestVelocityMps || 0), unit: 'm/s', digits: 2, higherIsBetter: true },
    { key: 'avgAscentTimeS', label: '平均上升时间', before: Number(before.summary.avgAscentTimeS || 0), after: Number(after.summary.avgAscentTimeS || 0), unit: 's', digits: 2, higherIsBetter: false },
  ]
}

export function getComparisonBlocker(before: Pick<PowerAnalysisJobDto, 'mode' | 'externalLoadKg'> | null, after: Pick<PowerAnalysisJobDto, 'mode' | 'externalLoadKg'> | null) {
  if (!before || !after || before.mode !== after.mode) return '动作类型不同，仅展示数值，不判断优劣'
  if (isCustomPowerAnalysisMode(after.mode)) return '其他动作为试验功能，仅展示数值，不判断优劣'
  // 杠铃越重速度越慢、功率越高，只有同重量才判断
  if (isBarbellPowerAnalysisMode(after.mode) && Number(before.externalLoadKg) !== Number(after.externalLoadKg)) {
    return '杠铃重量不同，仅展示数值，不判断优劣'
  }
  return ''
}

export function getPowerComparisonVerdict(rows: PowerComparisonRow[], blocker: string) {
  if (blocker) return blocker
  let score = 0
  for (const row of rows) {
    const tolerance = Math.max(Math.abs(row.before) * 0.01, row.digits === 0 ? 1 : 0.01)
    const delta = row.after - row.before
    if (Math.abs(delta) <= tolerance) continue
    score += (row.higherIsBetter ? delta > 0 : delta < 0) ? 1 : -1
  }
  if (score >= 2) return '后测综合表现更好'
  if (score <= -2) return '前测综合表现更好'
  return '两次表现接近，各有优势'
}

export function formatComparisonDelta(row: PowerComparisonRow) {
  const delta = row.after - row.before
  return `${delta > 0 ? '+' : ''}${delta.toFixed(row.digits)} ${row.unit}`
}

export function isComparisonImproved(row: PowerComparisonRow) {
  const delta = row.after - row.before
  return Math.abs(delta) > 0 && (row.higherIsBetter ? delta > 0 : delta < 0)
}

export function powerSummaryTiles(metrics: PowerAnalysisMetrics): Array<{ label: string; value: string; accent: boolean }> {
  const { summary } = metrics
  if (isCustomPowerAnalysisMode(metrics.mode)) {
    const [first, second] = metrics.custom?.phaseLabelsZh ?? ['去程', '回程']
    return [
      { label: '有效次数', value: String(metrics.repCount), accent: true },
      { label: '平均幅度', value: `${formatPowerMetric(averageOf(metrics.reps.map((rep) => rep.displacementM * 100)), 0)} cm`, accent: false },
      { label: `平均${first}`, value: `${formatPowerMetric(averageOf(metrics.reps.map((rep) => rep.phase1TimeS ?? 0)), 1)} s`, accent: false },
      { label: `平均${second}`, value: `${formatPowerMetric(averageOf(metrics.reps.map((rep) => rep.phase2TimeS ?? 0)), 1)} s`, accent: false },
    ]
  }
  if (isBarbellPowerAnalysisMode(metrics.mode)) {
    const loss = summary.velocityLossPct
    return [
      { label: '有效次数', value: String(metrics.repCount), accent: false },
      { label: '最佳平均速度', value: `${formatPowerMetric(summary.bestMeanVelocityMps, 2)} m/s`, accent: true },
      { label: '组内速度下降', value: typeof loss === 'number' ? `${formatPowerMetric(loss, 0)}%` : '-', accent: false },
      { label: '杠铃抬升功率', value: `${formatPowerMetric(summary.bestPowerW, 0)} W`, accent: false },
    ]
  }
  return [
    { label: '有效次数', value: String(metrics.repCount), accent: false },
    { label: '最高功率', value: `${formatPowerMetric(summary.bestPowerW, 0)} W`, accent: false },
    { label: '最高马力', value: `${formatPowerMetric(summary.bestHorsepowerHp, 2)} hp`, accent: true },
    { label: '最快速度', value: `${formatPowerMetric(summary.bestVelocityMps, 2)} m/s`, accent: false },
  ]
}

export function powerRepText(metrics: PowerAnalysisMetrics, rep: PowerAnalysisRepMetric) {
  if (isCustomPowerAnalysisMode(metrics.mode)) {
    const [first, second] = metrics.custom?.phaseLabelsZh ?? ['去程', '回程']
    const joint = typeof rep.jointMinDeg === 'number'
      ? ` · ${metrics.custom?.mainJointZh || '关节'} ${formatPowerMetric(rep.jointMinDeg, 0)}°～${formatPowerMetric(rep.jointMaxDeg, 0)}°`
      : ''
    return {
      main: `幅度 ${formatPowerMetric(rep.displacementM * 100, 0)} cm${joint}`,
      detail: `${first} ${formatPowerMetric(rep.phase1TimeS, 2)} s · ${second} ${formatPowerMetric(rep.phase2TimeS, 2)} s · 停留 ${formatPowerMetric(rep.holdTimeS, 2)} s`,
    }
  }
  return {
    main: isBarbellPowerAnalysisMode(metrics.mode)
      ? `平均速度 ${formatPowerMetric(rep.meanVelocityMps, 2)} m/s · ${formatPowerMetric(rep.avgPowerW, 0)} W`
      : `${formatPowerMetric(rep.avgPowerW, 0)} W · ${formatPowerMetric(rep.horsepowerHp, 2)} hp`,
    detail: `位移 ${formatPowerMetric(rep.displacementM, 2)} m · 上升 ${formatPowerMetric(rep.ascentTimeS, 2)} s · 最大速度 ${formatPowerMetric(rep.maxVelocityMps, 2)} m/s${typeof rep.pauseS === 'number' ? ` · 停顿 ${formatPowerMetric(rep.pauseS, 2)} s` : ''}`,
  }
}

const SCALE_SOURCE_ZH: Record<string, string> = {
  plate_diameter: '按杠铃片直径换算',
  body_height: '按身高换算',
  torso_segment: '按躯干长度估算',
  limb_segments: '按躯干和腿的长度换算',
  frame_fallback: '人物没有完整入镜，按画面高度粗略估算',
}

export function describePowerMeasurement(measurement?: PowerAnalysisMeasurement) {
  if (!measurement) return ''
  if (measurement.target === 'barbell_plate') {
    const coverage = typeof measurement.trackingCoverage === 'number' ? `，追踪覆盖 ${Math.round(measurement.trackingCoverage * 100)}%` : ''
    return `测量对象：杠铃片中心（按直径 ${measurement.plateDiameterCm ?? 45} cm 换算${coverage}）`
  }
  const scaleText = SCALE_SOURCE_ZH[measurement.scaleSource] || '按身高换算'
  if (measurement.target === 'barbell_body_proxy') {
    return `测量对象：${measurement.anchorLabelZh || '身体'}位置估算（没有识别到杠铃片，${scaleText}，误差较大）`
  }
  return `测量对象：${measurement.anchorLabelZh || '身体'}位置（${scaleText}）`
}

/** 结果里的音轨说明。 */
export function powerAudioText(video: PowerAnalysisMetrics['video']) {
  if (typeof video?.inputHasAudio !== 'boolean') return ''
  if (!video.inputHasAudio) return '上传视频未检测到音轨'
  return video.audioPreserved ? '已保留原视频背景音效' : '结果音轨异常，请重新分析'
}

export function isDailyLimitMessage(message?: string | null) {
  const text = String(message || '').toLowerCase()
  return text.includes('今天已经分析') || text.includes('今日分析') || text.includes('daily limit') || text.includes('次数已用完')
}
