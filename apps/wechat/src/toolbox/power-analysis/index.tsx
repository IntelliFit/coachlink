import { useEffect, useMemo, useRef, useState } from 'react'
import { usePageEnterTrace } from '@/utils/pageTrace'
import { WECHAT_FREE_RELEASE, WECHAT_FREE_LIMITS, wechatReleaseHeaders } from '@coachlink/core'
import { Input, Text, View, Video } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { API_BASE_URL, request } from '@/utils/request'
import { authService } from '@/services/authService'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import { useTheme } from '@/hooks/useTheme'
import {
  isBarbellPowerAnalysisMode,
  isCustomPowerAnalysisMode,
  isValidPlateDiameterCm,
  isValidPowerAnalysisLoadKg,
  parsePowerAnalysisCustomActionName,
  POWER_ANALYSIS_BARBELL_SHOOTING_TIP,
  POWER_ANALYSIS_CUSTOM_ACTION_NAME_MAX_LENGTH,
  POWER_ANALYSIS_CUSTOM_SHOOTING_TIP,
  POWER_ANALYSIS_DEFAULT_BARBELL_MASS_KG,
  POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM,
  POWER_ANALYSIS_MODE_OPTIONS as MODE_OPTIONS,
  type PowerAnalysisMode
} from '@coachlink/core/src/powerAnalysisModes'
import PowerCurveChart, { type PowerCurvePoint } from './PowerCurveChart'
import AssessmentSection, { type PowerAnalysisAssessment, type PowerAnalysisMeasurement } from './AssessmentSection'
import { reportPowerClientEvent } from './clientEvents'
import './index.scss'

type PowerAnalysisQuality = 'compressed' | 'original'
type OverlayLanguage = 'zh' | 'en'
type OverlayLanguagePreference = 'auto' | OverlayLanguage
type PowerAnalysisJobStatus = 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
type UploadPhase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'

interface PowerAnalysisRepMetric {
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

/** What the generic analyzer followed for a custom movement. */
interface PowerAnalysisCustomInfo {
  actionNameZh: string
  primaryPartZh: string
  phaseLabelsZh: [string, string]
  mainJointZh: string | null
}

interface PowerAnalysisMetrics {
  mode: PowerAnalysisMode
  mass?: {
    bodyWeightKg: number
    externalLoadKg: number
    effectiveMassKg: number
  }
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
  custom?: PowerAnalysisCustomInfo
  timeSeries?: PowerCurvePoint[]
  rating?: {
    level: 'low' | 'steady' | 'powerful' | 'beast'
    normalizedPowerWPerKg: number
    labelZh: string
    labelEn: string
    descriptionZh: string
    descriptionEn: string
  }
  video?: {
    inputSizeBytes?: number
    outputSizeBytes?: number
    inputHasAudio?: boolean
    outputHasAudio?: boolean
    audioPreserved?: boolean
    quality?: PowerAnalysisQuality
  }
  notes?: string[]
}

interface PowerAnalysisJobDto {
  id: string
  mode: PowerAnalysisMode
  heightCm: number
  weightKg: number
  externalLoadKg: number
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
  queueInfo?: {
    jobsAhead: number
    queuedAhead: number
    processingAhead: number
    totalQueued: number
  } | null
  ranking?: PowerAnalysisRankingDto | null
}

interface PowerAnalysisRankingMetricDto {
  rank: number
  participantTotal: number
  percentile: number
  bestValue: number
  isPersonalBest: boolean
}

interface PowerAnalysisRankingDto {
  scope: 'coachlink_nationwide_participants'
  scopeLabel: string
  power: PowerAnalysisRankingMetricDto
  speed: PowerAnalysisRankingMetricDto
}

interface CreatePowerAnalysisUploadUrlResponseDto {
  job: PowerAnalysisJobDto
  upload: {
    bucket: 'videos'
    path: string
    uploadUrl: string
    token: string
    expiresAt: string
  }
  limits: {
    maxVideoSizeMb: number
    dailyLimit: number
    maxDurationSeconds?: number
    canUseOriginalQuality?: boolean
    tier?: PowerAnalysisEntitlements['tier']
  }
}

interface PowerAnalysisEntitlements {
  tier: 'free' | 'basic' | 'premium' | 'trial'
  canUseOriginalQuality: boolean
  availableQualities: PowerAnalysisQuality[]
  maxVideoSizeMb: number
  maxDurationSeconds: number
  dailyLimit: number
}

interface PowerAnalysisDownloadUrlResponseDto {
  url: string
  proxyUrl?: string
  signedUrl?: string
  expiresInSeconds: number
  filename: string
}

interface SelectedVideo {
  tempFilePath: string
  name: string
  contentType: string
  size: number
  duration?: number
  width?: number
  height?: number
}

const TERMINAL_STATUSES: PowerAnalysisJobStatus[] = ['done', 'failed', 'expired']
// 动作分组展示：自重 / 杠铃三大项 / 其他。列表本身仍以 @coachlink/core 为准。
const MODE_GROUPS = [
  { title: '自重动作', options: MODE_OPTIONS.filter((item) => !item.barbell && item.value !== 'custom') },
  { title: '杠铃三大项', options: MODE_OPTIONS.filter((item) => item.barbell) },
  { title: '其他', options: MODE_OPTIONS.filter((item) => item.value === 'custom') }
].filter((group) => group.options.length > 0)
const SELECTED_VIDEO_ID = 'power-analysis-selected-video'
const LAST_DOWNLOADABLE_JOB_STORAGE_KEY = 'power-analysis-last-downloadable-job-v1'
const VIDEO_TRANSFER_TIMEOUT_MS = 15 * 60 * 1000
const WECHAT_CHOOSE_VIDEO_MAX_DURATION_SECONDS = 60
const POWER_ANALYSIS_CHUNK_SIZE_BYTES = 4 * 1024 * 1024
const POWER_ANALYSIS_CHUNK_RETRY_COUNT = 3
const POWER_ANALYSIS_UPLOAD_RETRY_COUNT = 2
const POWER_ANALYSIS_FILE_STABILITY_CHECKS = 4
const POWER_ANALYSIS_FILE_STABILITY_INTERVAL_MS = 160
const POWER_ANALYSIS_COMPARISON_STORAGE_KEY = 'power-analysis-comparison-baseline-v1'
const POWER_CHALLENGE_TEMPLATE_IDS = {
  power: 'b7bc1548-08ed-4f52-90cc-f5b22a785103',
  speed: 'b7bc1548-08ed-4f52-90cc-f5b22a785104'
} as const
const DEFAULT_ENTITLEMENTS: PowerAnalysisEntitlements = {
  tier: 'free',
  canUseOriginalQuality: WECHAT_FREE_RELEASE,
  availableQualities: WECHAT_FREE_RELEASE ? ['compressed', 'original'] : ['compressed'],
  maxVideoSizeMb: WECHAT_FREE_RELEASE ? WECHAT_FREE_LIMITS.powerVideoMb : 100,
  maxDurationSeconds: WECHAT_FREE_RELEASE ? WECHAT_FREE_LIMITS.powerDurationSeconds : 30,
  dailyLimit: WECHAT_FREE_RELEASE ? WECHAT_FREE_LIMITS.powerDaily : 5
}
function formatMetric(value: number | undefined, digits = 1) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(digits)
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '未知大小'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds?: number) {
  const n = Number(seconds || 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${Math.round(n)} 秒`
}

interface PowerComparisonRow {
  key: string
  label: string
  before: number
  after: number
  unit: string
  digits: number
  higherIsBetter: boolean
}

function buildCustomComparisonRows(before: PowerAnalysisMetrics, after: PowerAnalysisMetrics): PowerComparisonRow[] {
  return [
    { key: 'repCount', label: '有效次数', before: before.repCount, after: after.repCount, unit: '次', digits: 0, higherIsBetter: true },
    {
      key: 'avgDisplacementM',
      label: '平均幅度',
      before: Number(before.summary.avgDisplacementM || 0) * 100,
      after: Number(after.summary.avgDisplacementM || 0) * 100,
      unit: 'cm',
      digits: 0,
      higherIsBetter: true
    }
  ]
}

function buildPowerComparisonRows(before: PowerAnalysisMetrics, after: PowerAnalysisMetrics): PowerComparisonRow[] {
  if (isCustomPowerAnalysisMode(before.mode) || isCustomPowerAnalysisMode(after.mode)) {
    return buildCustomComparisonRows(before, after)
  }
  // Barbell lifts are judged on mean velocity; bodyweight movements keep their original four rows.
  const bothBarbell = isBarbellPowerAnalysisMode(before.mode) && isBarbellPowerAnalysisMode(after.mode)
  const meanVelocityRows: PowerComparisonRow[] =
    bothBarbell &&
    typeof before.summary.bestMeanVelocityMps === 'number' &&
    typeof after.summary.bestMeanVelocityMps === 'number'
      ? [
          {
            key: 'bestMeanVelocityMps',
            label: '最佳平均速度',
            before: before.summary.bestMeanVelocityMps,
            after: after.summary.bestMeanVelocityMps,
            unit: 'm/s',
            digits: 2,
            higherIsBetter: true
          }
        ]
      : []
  return [
    ...meanVelocityRows,
    {
      key: 'bestPowerW',
      label: '最高功率',
      before: Number(before.summary.bestPowerW || 0),
      after: Number(after.summary.bestPowerW || 0),
      unit: 'W',
      digits: 0,
      higherIsBetter: true
    },
    {
      key: 'avgPowerW',
      label: '平均功率',
      before: Number(before.summary.avgPowerW || 0),
      after: Number(after.summary.avgPowerW || 0),
      unit: 'W',
      digits: 0,
      higherIsBetter: true
    },
    {
      key: 'bestVelocityMps',
      label: '最快速度',
      before: Number(before.summary.bestVelocityMps || 0),
      after: Number(after.summary.bestVelocityMps || 0),
      unit: 'm/s',
      digits: 2,
      higherIsBetter: true
    },
    {
      key: 'avgAscentTimeS',
      label: '平均上升时间',
      before: Number(before.summary.avgAscentTimeS || 0),
      after: Number(after.summary.avgAscentTimeS || 0),
      unit: 's',
      digits: 2,
      higherIsBetter: false
    }
  ]
}

function getComparisonBlocker(before: PowerAnalysisJobDto | null, after: PowerAnalysisJobDto | null) {
  if (!before || !after || before.mode !== after.mode) return '动作类型不同，仅展示数值，不判断优劣'
  if (isCustomPowerAnalysisMode(after.mode)) return '其他动作为试验功能，仅展示数值，不判断优劣'
  // Heavier bars move slower and produce more power, so only same-weight barbell tests are judged.
  if (isBarbellPowerAnalysisMode(after.mode) && Number(before.externalLoadKg) !== Number(after.externalLoadKg)) {
    return '杠铃重量不同，仅展示数值，不判断优劣'
  }
  return ''
}

function getPowerComparisonVerdict(rows: PowerComparisonRow[], blocker: string) {
  if (blocker) return blocker
  let score = 0
  for (const row of rows) {
    const tolerance = Math.max(Math.abs(row.before) * 0.01, row.digits === 0 ? 1 : 0.01)
    const delta = row.after - row.before
    if (Math.abs(delta) <= tolerance) continue
    const improved = row.higherIsBetter ? delta > 0 : delta < 0
    score += improved ? 1 : -1
  }
  if (score >= 2) return '后测综合表现更好'
  if (score <= -2) return '前测综合表现更好'
  return '两次表现接近，各有优势'
}

function formatComparisonDelta(row: PowerComparisonRow) {
  const delta = row.after - row.before
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(row.digits)} ${row.unit}`
}

function averageOf(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0
}

function customSummaryTiles(metrics: PowerAnalysisMetrics) {
  const [first, second] = metrics.custom?.phaseLabelsZh ?? ['去程', '回程']
  return [
    { label: '有效次数', value: String(metrics.repCount), accent: true },
    { label: '平均幅度', value: `${formatMetric(averageOf(metrics.reps.map((rep) => rep.displacementM * 100)), 0)} cm`, accent: false },
    { label: `平均${first}`, value: `${formatMetric(averageOf(metrics.reps.map((rep) => rep.phase1TimeS ?? 0)), 1)} s`, accent: false },
    { label: `平均${second}`, value: `${formatMetric(averageOf(metrics.reps.map((rep) => rep.phase2TimeS ?? 0)), 1)} s`, accent: false }
  ]
}

function customRepText(metrics: PowerAnalysisMetrics, rep: PowerAnalysisRepMetric) {
  const [first, second] = metrics.custom?.phaseLabelsZh ?? ['去程', '回程']
  const joint = typeof rep.jointMinDeg === 'number'
    ? ` · ${metrics.custom?.mainJointZh || '关节'} ${formatMetric(rep.jointMinDeg, 0)}°～${formatMetric(rep.jointMaxDeg, 0)}°`
    : ''
  return {
    main: `幅度 ${formatMetric(rep.displacementM * 100, 0)} cm${joint}`,
    detail: `${first} ${formatMetric(rep.phase1TimeS, 2)} s · ${second} ${formatMetric(rep.phase2TimeS, 2)} s · 停留 ${formatMetric(rep.holdTimeS, 2)} s`
  }
}

function summaryTiles(metrics: PowerAnalysisMetrics, barbell: boolean) {
  if (isCustomPowerAnalysisMode(metrics.mode)) return customSummaryTiles(metrics)
  const { summary } = metrics
  if (barbell) {
    const loss = summary.velocityLossPct
    return [
      { label: '有效次数', value: String(metrics.repCount), accent: false },
      { label: '最佳平均速度', value: `${formatMetric(summary.bestMeanVelocityMps, 2)} m/s`, accent: true },
      { label: '组内速度下降', value: typeof loss === 'number' ? `${formatMetric(loss, 0)}%` : '-', accent: false },
      { label: '杠铃抬升功率', value: `${formatMetric(summary.bestPowerW, 0)} W`, accent: false }
    ]
  }
  return [
    { label: '有效次数', value: String(metrics.repCount), accent: false },
    { label: '最高功率', value: `${formatMetric(summary.bestPowerW, 0)} W`, accent: false },
    { label: '最高马力', value: `${formatMetric(summary.bestHorsepowerHp, 2)} hp`, accent: true },
    { label: '最快速度', value: `${formatMetric(summary.bestVelocityMps, 2)} m/s`, accent: false }
  ]
}

function inferVideoName(filePath: string) {
  const cleanPath = String(filePath || '').split('?')[0]
  const tail = cleanPath.split('/').pop() || ''
  if (/\.(mp4|mov|webm|mkv|avi)$/i.test(tail)) return tail
  return `power-analysis-${Date.now()}.mp4`
}

function inferContentType(filename: string) {
  const ext = String(filename || '').split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv') return 'video/x-matroska'
  if (ext === 'avi') return 'video/x-msvideo'
  return 'video/mp4'
}

function detectSystemOverlayLanguage(): OverlayLanguage {
  try {
    const language = String(Taro.getSystemInfoSync().language || '').toLowerCase()
    return language.startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

function membershipLabel(tier: PowerAnalysisEntitlements['tier']) {
  if (tier === 'basic') return '基础会员'
  if (tier === 'premium') return '高级会员'
  if (tier === 'trial') return '试用会员'
  return '免费用户'
}

async function callPowerApi<T>(options: {
  url: string
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
}) {
  const res = await request<T>({
    url: options.url,
    method: options.method || 'GET',
    data: options.data,
    showErrorToast: false
  })

  if (!res.success || !res.data) {
    throw new Error(res.message || '请求失败')
  }

  return res.data
}

function createPowerUploadId() {
  return `power_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

function waitForPowerUpload(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getPowerAnalysisFileSize(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    Taro.getFileInfo({
      filePath,
      success: (result: any) => {
        const size = Number(result?.size || 0)
        if (Number.isInteger(size) && size > 0) {
          resolve(size)
          return
        }
        reject(new Error('无法读取视频实际大小'))
      },
      fail: (error: any) => reject(new Error(error?.errMsg || '无法读取视频实际大小'))
    })
  })
}

async function getStablePowerAnalysisFileSize(filePath: string, reportedSize = 0) {
  let previousSize = 0
  let stableReads = 0

  for (let attempt = 0; attempt < POWER_ANALYSIS_FILE_STABILITY_CHECKS; attempt += 1) {
    const currentSize = await getPowerAnalysisFileSize(filePath)
    if (currentSize === previousSize) stableReads += 1
    else stableReads = 1
    previousSize = currentSize
    if (stableReads >= 2) return currentSize
    if (attempt < POWER_ANALYSIS_FILE_STABILITY_CHECKS - 1) {
      await waitForPowerUpload(POWER_ANALYSIS_FILE_STABILITY_INTERVAL_MS)
    }
  }

  if (Number.isInteger(previousSize) && previousSize > 0) return previousSize
  if (Number.isInteger(reportedSize) && reportedSize > 0) return reportedSize
  throw new Error('视频临时文件尚未准备完成，请重新选择')
}

function normalizeFileReadData(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  }
  return null
}

async function readPowerAnalysisVideoChunk(filePath: string, position: number, length: number) {
  let lastSize = 0
  let lastError: Error | null = null

  for (let attempt = 0; attempt < POWER_ANALYSIS_CHUNK_RETRY_COUNT; attempt += 1) {
    try {
      const chunk = await new Promise<ArrayBuffer>((resolve, reject) => {
        const fileSystem = Taro.getFileSystemManager() as any
        fileSystem.readFile({
          filePath,
          position,
          length,
          success: (result: any) => {
            const data = normalizeFileReadData(result?.data)
            if (data && data.byteLength > 0) {
              resolve(data)
              return
            }
            reject(new Error('读取视频分片失败'))
          },
          fail: (error: any) => reject(new Error(error?.errMsg || '读取视频分片失败'))
        })
      })
      lastSize = chunk.byteLength
      if (lastSize === length) return chunk
      lastError = new Error(`视频分片读取不完整（应为 ${length}，实际 ${lastSize}）`)
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('读取视频分片失败')
    }
    if (attempt < POWER_ANALYSIS_CHUNK_RETRY_COUNT - 1) {
      await waitForPowerUpload(POWER_ANALYSIS_FILE_STABILITY_INTERVAL_MS * (attempt + 1))
    }
  }

  throw lastError || new Error(`视频分片读取不完整（应为 ${length}，实际 ${lastSize}）`)
}

function parsePowerUploadResponse(data: unknown) {
  if (typeof data !== 'string') return data as any
  try {
    return JSON.parse(data || '{}')
  } catch {
    return null
  }
}

async function uploadPowerAnalysisChunk(url: string, chunk: ArrayBuffer, token: string) {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < POWER_ANALYSIS_CHUNK_RETRY_COUNT; attempt += 1) {
    try {
      const response: any = await Taro.request({
        url,
        method: 'POST',
        data: chunk,
        header: {
          ...wechatReleaseHeaders(),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        timeout: 120000
      } as any)
      const payload = parsePowerUploadResponse(response.data)
      if (response.statusCode < 200 || response.statusCode >= 300 || !payload?.success) {
        const error = new Error(payload?.message || `视频分片上传失败（${response.statusCode}）`)
        if ([401, 403, 409, 413].includes(Number(response.statusCode))) throw error
        lastError = error
      } else {
        const receivedSize = Number(payload?.data?.receivedSize ?? -1)
        if (receivedSize === chunk.byteLength) return
        lastError = new Error(`服务端收到的分片不完整（应为 ${chunk.byteLength}，实际 ${receivedSize}）`)
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('视频分片上传失败')
      if (/用户未登录|会员|状态已变化|过大/.test(lastError.message)) throw lastError
    }
    if (attempt < POWER_ANALYSIS_CHUNK_RETRY_COUNT - 1) {
      await waitForPowerUpload(300 * (attempt + 1))
    }
  }
  throw lastError || new Error('视频分片上传失败')
}

async function uploadPowerAnalysisVideo(params: {
  jobId: string
  filePath: string
  contentType: string
  fileSize: number
  onProgress: (progress: number) => void
}): Promise<number> {
  const token = String(Taro.getStorageSync('token') || '').trim()
  if (!token) throw new Error('请先登录后再使用视频分析工具')
  let lastError: Error | null = null

  for (let uploadAttempt = 0; uploadAttempt < POWER_ANALYSIS_UPLOAD_RETRY_COUNT; uploadAttempt += 1) {
    const fileSize = await getStablePowerAnalysisFileSize(params.filePath, params.fileSize)
    if (!Number.isInteger(fileSize) || fileSize <= 0) {
      throw new Error('无法读取视频大小，请重新选择')
    }

    const uploadId = createPowerUploadId()
    const totalChunks = Math.ceil(fileSize / POWER_ANALYSIS_CHUNK_SIZE_BYTES)
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const position = chunkIndex * POWER_ANALYSIS_CHUNK_SIZE_BYTES
        const length = Math.min(POWER_ANALYSIS_CHUNK_SIZE_BYTES, fileSize - position)
        const chunk = await readPowerAnalysisVideoChunk(params.filePath, position, length)
        const query = [
          ['action', 'chunk'],
          ['uploadId', uploadId],
          ['chunkIndex', String(chunkIndex)],
          ['chunkSize', String(chunk.byteLength)],
          ['totalChunks', String(totalChunks)],
          ['totalSize', String(fileSize)]
        ]
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&')
        await uploadPowerAnalysisChunk(
          `${API_BASE_URL}/api/toolbox/power-analysis/jobs/${params.jobId}/upload-chunk?${query}`,
          chunk,
          token
        )
        params.onProgress(Math.max(1, Math.min(95, Math.round(((chunkIndex + 1) / totalChunks) * 95))))
      }

      const finalSize = await getStablePowerAnalysisFileSize(params.filePath, fileSize)
      if (finalSize !== fileSize) {
        throw new Error(`视频临时文件大小发生变化（${fileSize} → ${finalSize}），正在重新上传`)
      }

      await callPowerApi<PowerAnalysisJobDto>({
        url: `/api/toolbox/power-analysis/jobs/${params.jobId}/upload-chunk?action=complete`,
        method: 'POST',
        data: {
          uploadId,
          totalSize: fileSize,
          totalChunks,
          contentType: params.contentType
        }
      })
      params.onProgress(100)
      return fileSize
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('视频上传失败')
      if (/用户未登录|会员|状态已变化|过大|次数/.test(lastError.message)) throw lastError
      if (uploadAttempt < POWER_ANALYSIS_UPLOAD_RETRY_COUNT - 1) {
        params.onProgress(1)
        await waitForPowerUpload(500)
      }
    }
  }

  throw lastError || new Error('视频上传失败')
}

function isAuthErrorMessage(message?: string | null) {
  if (!message) return false
  const normalized = String(message).toLowerCase()
  return (
    normalized.includes('用户未登录') ||
    normalized.includes('请先登录') ||
    normalized.includes('unauthorized') ||
    normalized.includes('token expired') ||
    normalized.includes('invalid token')
  )
}

function isDailyLimitMessage(message?: string | null) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('今天已经分析') ||
    normalized.includes('今日分析') ||
    normalized.includes('daily limit') ||
    normalized.includes('次数已用完')
  )
}

async function downloadAndSaveVideo(url: string, header?: Record<string, string>) {
  const downloaded = await Taro.downloadFile({
    url,
    timeout: VIDEO_TRANSFER_TIMEOUT_MS,
    header
  })
  if (downloaded.statusCode !== 200 || !downloaded.tempFilePath) {
    throw new Error(`下载失败（${downloaded.statusCode}）`)
  }
  await Taro.saveVideoToPhotosAlbum({ filePath: downloaded.tempFilePath })
}

export default function WechatPowerAnalysisPage() {
  usePageEnterTrace()

  const { effectiveTheme } = useTheme()
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const llmRequestedRef = useRef<string | null>(null)
  const restoredDownloadUserRef = useRef<string | null>(null)
  const restoredComparisonUserRef = useRef<string | null>(null)
  const jobRef = useRef<PowerAnalysisJobDto | null>(null)

  const [mode, setMode] = useState<PowerAnalysisMode>('pullup')
  const [heightCm, setHeightCm] = useState('175')
  const [weightKg, setWeightKg] = useState('70')
  const [externalLoadKg, setExternalLoadKg] = useState('0')
  const [barbellKg, setBarbellKg] = useState(String(POWER_ANALYSIS_DEFAULT_BARBELL_MASS_KG))
  const [plateDiameterCm, setPlateDiameterCm] = useState(String(POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM))
  const [customActionName, setCustomActionName] = useState('')
  const [quality, setQuality] = useState<PowerAnalysisQuality>('compressed')
  const [languagePreference, setLanguagePreference] = useState<OverlayLanguagePreference>('auto')
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false)
  const [entitlements, setEntitlements] = useState<PowerAnalysisEntitlements>(DEFAULT_ENTITLEMENTS)
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [job, setJob] = useState<PowerAnalysisJobDto | null>(null)
  const [comparisonBaselineJob, setComparisonBaselineJob] = useState<PowerAnalysisJobDto | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [savingVideo, setSavingVideo] = useState(false)
  const [downloadRetryAvailable, setDownloadRetryAvailable] = useState(false)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '功率视频分析',
        path: buildSharePath('/toolbox/power-analysis/index')
      }),
    []
  )

  const resultModeValue = job?.mode ?? mode
  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((item) => item.value === resultModeValue) || MODE_OPTIONS[0],
    [resultModeValue]
  )

  const metrics = job?.metrics || null
  const comparisonBaselineMetrics = comparisonBaselineJob?.metrics || null
  const comparisonRows = useMemo(
    () => comparisonBaselineMetrics && metrics && comparisonBaselineJob?.id !== job?.id
      ? buildPowerComparisonRows(comparisonBaselineMetrics, metrics)
      : [],
    [comparisonBaselineJob?.id, comparisonBaselineMetrics, job?.id, metrics]
  )
  const comparisonVerdict = comparisonRows.length > 0
    ? getPowerComparisonVerdict(comparisonRows, getComparisonBlocker(comparisonBaselineJob, job))
    : ''
  const overlayLanguage = languagePreference === 'auto'
    ? detectSystemOverlayLanguage()
    : languagePreference
  const heightValue = Number(heightCm)
  const weightValue = Number(weightKg)
  const isBarbell = isBarbellPowerAnalysisMode(mode)
  const selectedFormMode = MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0]
  const isCustom = isCustomPowerAnalysisMode(mode)
  const resultIsBarbell = isBarbellPowerAnalysisMode(metrics?.mode)
  const resultIsCustom = isCustomPowerAnalysisMode(metrics?.mode)
  const resultLabel = isCustomPowerAnalysisMode(job?.mode) && job?.customActionName
    ? `其他动作 · ${job.customActionName}`
    : selectedMode.label
  const externalLoadValue = Number(isBarbell ? barbellKg : externalLoadKg)
  const formReady =
    Number.isFinite(heightValue) &&
    heightValue >= 100 &&
    heightValue <= 250 &&
    Number.isFinite(weightValue) &&
    weightValue >= 30 &&
    weightValue <= 250 &&
    isValidPowerAnalysisLoadKg(mode, externalLoadValue) &&
    (!isBarbell || isValidPlateDiameterCm(plateDiameterCm)) &&
    (!isCustom || parsePowerAnalysisCustomActionName(customActionName).ok)
  const isBusy =
    ['creating', 'uploading', 'enqueueing', 'queued'].includes(phase) ||
    job?.status === 'queued' ||
    job?.status === 'processing'
  const settingsLocked = isBusy || phase === 'uploaded'
  const canSubmit =
    Boolean(video) &&
    formReady &&
    phase === 'uploaded' &&
    job?.status === 'awaiting_upload'

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    jobRef.current = job
    if (job?.status !== 'done' || !job.canDownload || !job.id) return

    const userId = authService.getAuthSession({ normalize: true }).userId
    if (!userId) return
    try {
      Taro.setStorageSync(LAST_DOWNLOADABLE_JOB_STORAGE_KEY, {
        v: 1,
        userId,
        jobId: job.id
      })
    } catch (error) {
      console.warn('[power-analysis] failed to persist downloadable job', error)
    }
  }, [job])

  useDidShow(() => {
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated || !session.userId) {
      setEntitlements(DEFAULT_ENTITLEMENTS)
      setQuality('compressed')
      restoredDownloadUserRef.current = null
      restoredComparisonUserRef.current = null
      setComparisonBaselineJob(null)
      return
    }

    void callPowerApi<PowerAnalysisEntitlements>({
      url: '/api/toolbox/power-analysis/entitlements'
    })
      .then((next) => {
        setEntitlements(next)
        if (!next.availableQualities.includes(quality)) setQuality('compressed')
      })
      .catch(() => setEntitlements(DEFAULT_ENTITLEMENTS))

    if (restoredComparisonUserRef.current !== session.userId) {
      restoredComparisonUserRef.current = session.userId
      let comparisonStored: { v?: number; userId?: string; jobId?: string } | null = null
      try {
        comparisonStored = Taro.getStorageSync(POWER_ANALYSIS_COMPARISON_STORAGE_KEY) as typeof comparisonStored
      } catch (error) {
        console.warn('[power-analysis] failed to read comparison baseline', error)
      }
      if (
        comparisonStored?.v === 1 &&
        String(comparisonStored.userId || '') === session.userId &&
        String(comparisonStored.jobId || '').trim()
      ) {
        void callPowerApi<PowerAnalysisJobDto>({
          url: `/api/toolbox/power-analysis/jobs/${comparisonStored.jobId}`
        })
          .then((restored) => {
            if (restored.status === 'done' && restored.metrics) setComparisonBaselineJob(restored)
          })
          .catch(() => Taro.removeStorageSync(POWER_ANALYSIS_COMPARISON_STORAGE_KEY))
      } else {
        setComparisonBaselineJob(null)
      }
    }

    if (restoredDownloadUserRef.current === session.userId) return
    restoredDownloadUserRef.current = session.userId

    let stored: { v?: number; userId?: string; jobId?: string } | null = null
    try {
      stored = Taro.getStorageSync(LAST_DOWNLOADABLE_JOB_STORAGE_KEY) as typeof stored
    } catch (error) {
      console.warn('[power-analysis] failed to read downloadable job', error)
    }
    if (
      stored?.v !== 1 ||
      String(stored.userId || '') !== session.userId ||
      !String(stored.jobId || '').trim()
    ) {
      return
    }

    void callPowerApi<PowerAnalysisJobDto>({
      url: `/api/toolbox/power-analysis/jobs/${stored.jobId}`
    })
      .then((restored) => {
        if (jobRef.current || restored.status !== 'done' || !restored.canDownload) return
        setJob(restored)
        setPhase('done')
      })
      .catch(() => {
        Taro.removeStorageSync(LAST_DOWNLOADABLE_JOB_STORAGE_KEY)
      })
  })

  const phaseRef = useRef<UploadPhase>(phase)
  const uploadProgressRef = useRef(0)
  phaseRef.current = phase
  uploadProgressRef.current = uploadProgress

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      const pending = jobRef.current
      if (pending?.status !== 'awaiting_upload') return
      if (phaseRef.current === 'uploading') {
        reportPowerClientEvent(pending.id, 'left_during_upload', { progress: uploadProgressRef.current })
      } else if (phaseRef.current === 'uploaded') {
        reportPowerClientEvent(pending.id, 'left_without_start')
      }
    }
  }, [])

  const openLogin = () => {
    Taro.navigateTo({ url: authService.buildLoginUrl('/toolbox/power-analysis/index') })
  }

  const promptLogin = (content: string) => {
    Taro.showModal({
      title: '登录后可用',
      content,
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          openLogin()
        }
      }
    })
  }

  const openMembership = () => {
    Taro.navigateTo({ url: '/me/membership/subscribe/index?tab=membership' })
  }

  const handleQualityChange = (nextQuality: PowerAnalysisQuality) => {
    if (settingsLocked) return
    if (nextQuality === 'original' && !entitlements.canUseOriginalQuality) {
      if (WECHAT_FREE_RELEASE) {
        Taro.showToast({ title: '原画质服务暂不可用，请稍后重试', icon: 'none' })
        return
      }
      Taro.showModal({
        title: '会员原画质',
        content: '开通会员后可上传原画质视频，并获得更大的视频与分析额度。',
        confirmText: '查看会员',
        success: (res) => {
          if (res.confirm) openMembership()
        }
      })
      return
    }
    setQuality(nextQuality)
    if (video) {
      setVideo(null)
      setJob(null)
      setPhase('idle')
      setUploadProgress(0)
      llmRequestedRef.current = null
    }
  }

  const generateSummary = async (jobId: string) => {
    setSummaryLoading(true)
    try {
      const next = await callPowerApi<PowerAnalysisJobDto>({
        url: `/api/toolbox/power-analysis/jobs/${jobId}/llm-summary`,
        method: 'POST'
      })
      setJob(next)
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || 'AI 解读暂未生成',
        icon: 'none',
        duration: 2500
      })
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    if (!job?.id || job.status !== 'done' || job.llmSummary || llmRequestedRef.current === job.id) return
    llmRequestedRef.current = job.id
    void generateSummary(job.id)
  }, [job?.id, job?.status, job?.llmSummary])

  const handleSeekVideo = (timeS: number) => {
    if (!video) return
    Taro.pageScrollTo({ selector: '.selected-video-wrap', duration: 300 })
    const context = Taro.createVideoContext(SELECTED_VIDEO_ID)
    context.seek(Math.max(0, timeS - 0.5))
    context.play()
  }

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const pollJob = (jobId: string) => {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      try {
        const next = await callPowerApi<PowerAnalysisJobDto>({
          url: `/api/toolbox/power-analysis/jobs/${jobId}`
        })
        setJob(next)
        if (TERMINAL_STATUSES.includes(next.status)) {
          stopPolling()
          setPhase('done')
        }
      } catch (error: any) {
        stopPolling()
        setPhase('idle')
        Taro.showToast({
          title: error?.message || '任务状态获取失败',
          icon: 'none',
          duration: 2500
        })
      }
    }, 1800)
  }

  const prepareUpload = async (nextVideo: SelectedVideo) => {
    if (!formReady) {
      Taro.showToast({
        title: isBarbell ? '请先填写有效身高体重和杠铃重量' : isCustom ? '请先填写动作名称和有效身高体重' : '请先填写有效身高体重',
        icon: 'none'
      })
      return
    }

    let verifiedSize = 0
    try {
      verifiedSize = await getStablePowerAnalysisFileSize(nextVideo.tempFilePath, nextVideo.size)
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || '视频文件尚未准备完成，请重新选择',
        icon: 'none',
        duration: 3000
      })
      return
    }
    const preparedVideo = { ...nextVideo, size: verifiedSize }
    const maxSizeBytes = entitlements.maxVideoSizeMb * 1024 * 1024
    if (!Number.isFinite(preparedVideo.size) || preparedVideo.size <= 0) {
      Taro.showToast({ title: '无法读取视频大小，请重新选择', icon: 'none' })
      return
    }
    if (preparedVideo.size > maxSizeBytes) {
      Taro.showToast({
        title: `当前等级最多支持 ${entitlements.maxVideoSizeMb}MB`,
        icon: 'none',
        duration: 3000
      })
      return
    }
    if (Number(preparedVideo.duration || 0) > entitlements.maxDurationSeconds) {
      Taro.showToast({
        title: `当前等级最多支持 ${entitlements.maxDurationSeconds} 秒`,
        icon: 'none',
        duration: 3000
      })
      return
    }

    stopPolling()
    const previousDownloadableJob = job?.status === 'done' && job.canDownload ? job : null
    setVideo(preparedVideo)
    setJob(null)
    setUploadProgress(0)
    llmRequestedRef.current = null

    let createdJobId: string | null = null
    try {
      setPhase('creating')
      const created = await callPowerApi<CreatePowerAnalysisUploadUrlResponseDto>({
        url: '/api/toolbox/power-analysis/create-upload-url',
        method: 'POST',
        data: {
          mode,
          heightCm: heightValue,
          weightKg: weightValue,
          externalLoadKg: externalLoadValue,
          ...(isBarbell ? { plateDiameterCm: Number(plateDiameterCm) } : {}),
          ...(isCustom ? { customActionName: customActionName.trim() } : {}),
          originalFilename: preparedVideo.name,
          contentType: preparedVideo.contentType,
          fileSizeBytes: preparedVideo.size,
          durationSeconds: preparedVideo.duration,
          quality,
          overlayLanguage
        }
      })
      setJob(created.job)
      createdJobId = created.job.id

      setPhase('uploading')
      setUploadProgress(1)
      const uploadedSize = await uploadPowerAnalysisVideo({
        jobId: created.job.id,
        filePath: preparedVideo.tempFilePath,
        contentType: preparedVideo.contentType,
        fileSize: preparedVideo.size,
        onProgress: setUploadProgress
      })
      setVideo((current) => current ? { ...current, size: uploadedSize } : current)

      setPhase('uploaded')
      Taro.showToast({ title: '视频已上传', icon: 'success' })
    } catch (error: any) {
      const message = error?.message || '上传失败'
      reportPowerClientEvent(createdJobId, 'upload_failed', {
        stage: 'upload',
        message: String(error?.errMsg || message),
        progress: uploadProgressRef.current
      })
      setUploadProgress(0)

      if (previousDownloadableJob) {
        setVideo(null)
        setJob(previousDownloadableJob)
        setPhase('done')
        if (isDailyLimitMessage(message)) {
          Taro.showModal({
            title: '今日分析次数已用完',
            content: `${message}。上一份结果仍可下载，无需重复分析。`,
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }
      } else {
        setPhase('idle')
        setJob(null)
      }

      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 3000
      })
    }
  }

  const handleChooseVideo = async () => {
    if (!authService.isAuthenticated()) {
      promptLogin('功率视频分析需要登录后才能上传和分析视频。')
      return
    }

    if (isBusy) {
      Taro.showToast({ title: '当前任务处理中', icon: 'none' })
      return
    }

    try {
      const res = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        // 微信 chooseVideo 的 maxDuration 只控制相机拍摄，且参数上限为 60 秒。
        // 会员可从相册选择更长视频，实际权益时长仍由 prepareUpload 和服务端校验。
        maxDuration: Math.min(
          entitlements.maxDurationSeconds,
          WECHAT_CHOOSE_VIDEO_MAX_DURATION_SECONDS
        ),
        compressed: quality === 'compressed',
        camera: 'back'
      })
      const name = inferVideoName(res.tempFilePath)
      const nextVideo = {
        tempFilePath: res.tempFilePath,
        name,
        contentType: inferContentType(name),
        size: Number(res.size || 0),
        duration: Number(res.duration || 0),
        width: Number(res.width || 0),
        height: Number(res.height || 0)
      }
      void prepareUpload(nextVideo)
    } catch (error: any) {
      const message = String(error?.errMsg || error?.message || '')
      if (message.includes('cancel')) return
      console.error('[power-analysis] chooseVideo failed:', error)
      Taro.showToast({ title: '选择视频失败', icon: 'none' })
    }
  }

  const handlePreviewVideo = async () => {
    if (!video?.tempFilePath) {
      Taro.showToast({ title: '请先选择视频', icon: 'none' })
      return
    }

    try {
      await Taro.previewMedia({
        sources: [{ url: video.tempFilePath, type: 'video' }],
        current: 0,
        showmenu: false
      })
    } catch (error: any) {
      try {
        await Taro.navigateTo({
          url: `/common/common/video-player?url=${encodeURIComponent(video.tempFilePath)}&title=${encodeURIComponent('视频预览')}`
        })
      } catch {
        Taro.showToast({
          title: error?.errMsg || error?.message || '视频预览失败',
          icon: 'none',
          duration: 2500
        })
      }
    }
  }

  const handleStart = async () => {
    if (!authService.isAuthenticated()) {
      promptLogin('登录后才可以开始分析并保存结果视频。')
      return
    }

    if (!canSubmit || !job?.id) {
      Taro.showToast({ title: '请先等待视频上传完成', icon: 'none' })
      return
    }

    stopPolling()
    llmRequestedRef.current = null

    try {
      setPhase('enqueueing')
      const queued = await callPowerApi<PowerAnalysisJobDto>({
        url: `/api/toolbox/power-analysis/jobs/${job.id}/enqueue`,
        method: 'POST'
      })
      setJob(queued)
      setPhase('queued')
      pollJob(queued.id)
      Taro.showToast({ title: '已开始分析', icon: 'success' })
    } catch (error: any) {
      setPhase('uploaded')
      if (isAuthErrorMessage(error?.message)) {
        promptLogin('登录状态失效后无法继续分析，请重新登录。')
        return
      }
      Taro.showToast({
        title: error?.message || '提交分析失败',
        icon: 'none',
        duration: 3000
      })
    }
  }

  const handleReset = () => {
    stopPolling()
    setVideo(null)
    setJob(null)
    setPhase('idle')
    setUploadProgress(0)
    llmRequestedRef.current = null
    setDownloadRetryAvailable(false)
  }

  const handleCompareNext = () => {
    if (!job?.id || job.status !== 'done' || !job.metrics) {
      Taro.showToast({ title: '请先完成一次分析', icon: 'none' })
      return
    }
    const userId = authService.getAuthSession({ normalize: true }).userId
    if (!userId) {
      promptLogin('登录后才可以保存前测结果并进行对比。')
      return
    }
    setComparisonBaselineJob(job)
    try {
      Taro.setStorageSync(POWER_ANALYSIS_COMPARISON_STORAGE_KEY, {
        v: 1,
        userId,
        jobId: job.id
      })
    } catch (error) {
      console.warn('[power-analysis] failed to persist comparison baseline', error)
    }
    handleReset()
    Taro.showToast({ title: '前测已保存，请选择后测视频', icon: 'success', duration: 2500 })
  }

  const handleClearComparison = () => {
    setComparisonBaselineJob(null)
    try {
      Taro.removeStorageSync(POWER_ANALYSIS_COMPARISON_STORAGE_KEY)
    } catch (error) {
      console.warn('[power-analysis] failed to clear comparison baseline', error)
    }
    Taro.showToast({ title: '已清除前测', icon: 'none' })
  }

  const handleSaveVideo = async () => {
    if (!job?.id || !job.canDownload) return
    setSavingVideo(true)
    let fallbackUrl = ''
    try {
      const data = await callPowerApi<PowerAnalysisDownloadUrlResponseDto>({
        url: `/api/toolbox/power-analysis/jobs/${job.id}/download-url`,
        method: 'POST'
      })
      const token = String(Taro.getStorageSync('token') || '').trim()
      const downloadUrl = data.proxyUrl
        ? `${API_BASE_URL.replace(/\/+$/, '')}${data.proxyUrl}`
        : data.url
      fallbackUrl = String(data.signedUrl || data.url || '').trim()
      try {
        await downloadAndSaveVideo(
          downloadUrl,
          data.proxyUrl && token ? { Authorization: `Bearer ${token}` } : undefined
        )
      } catch (proxyError) {
        const signedUrl = String(data.signedUrl || '').trim()
        if (!signedUrl || signedUrl === downloadUrl) throw proxyError

        try {
          await downloadAndSaveVideo(signedUrl)
          Taro.showToast({ title: '已通过备用链接保存', icon: 'success' })
          setDownloadRetryAvailable(false)
          return
        } catch {
          await Taro.setClipboardData({ data: signedUrl })
          throw new Error('下载未完成，可再次点击“重新下载”重试；备用链接已复制')
        }
      }
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
      setDownloadRetryAvailable(false)
    } catch (error: any) {
      setDownloadRetryAvailable(true)
      if (fallbackUrl) {
        await Taro.setClipboardData({ data: fallbackUrl }).catch(() => undefined)
      }
      Taro.showToast({
        title: fallbackUrl
          ? '下载未完成，可重试；备用链接已复制'
          : error?.message || '下载未完成，可点击重新下载',
        icon: 'none',
        duration: 3500
      })
    } finally {
      setSavingVideo(false)
    }
  }

  const statusText = (() => {
    if (phase === 'creating') return '创建临时任务'
    if (phase === 'uploading') return `上传视频 ${uploadProgress}%`
    if (phase === 'uploaded') return '视频已上传，点击开始分析'
    if (phase === 'enqueueing') return '提交分析任务'
    if (job?.status === 'queued') return '排队中'
    if (job?.status === 'processing') return `分析中 ${job.progress}%`
    if (job?.status === 'done') return '分析完成'
    if (job?.status === 'failed') return '分析失败'
    if (job?.status === 'expired') return '任务已过期'
    return '选择视频后会自动上传'
  })()

  const progressValue = (() => {
    if (job?.status === 'done') return 100
    if (job?.status === 'processing' || job?.status === 'queued') return Math.max(5, job.progress || 5)
    if (phase === 'uploaded') return 100
    if (phase === 'enqueueing') return 100
    if (phase === 'uploading') return uploadProgress
    if (phase === 'creating') return 5
    return 0
  })()
  const queueStatusText = (() => {
    const queueInfo = job?.queueInfo
    if (!queueInfo || (job?.status !== 'queued' && job?.status !== 'processing')) return ''
    if (job.status === 'processing') return `正在分析你的视频，后面还有 ${queueInfo.totalQueued} 个任务等待`
    if (queueInfo.jobsAhead <= 0) return '你排在最前面，马上开始分析'
    return `前面还有 ${queueInfo.jobsAhead} 个任务，其中 ${queueInfo.processingAhead} 个正在分析、${queueInfo.queuedAhead} 个在等待`
  })()

  return (
    <View className={`power-analysis-page pa-v1 theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      <View className='page-content'>
          <View className='pa-intro'>
            <Text className='pa-intro__title'>功率视频分析</Text>
            <Text className='pa-intro__desc'>上传一段训练视频，测速度、功率，看动作问题。视频只做临时分析，完成后可保存带标注的结果。</Text>
          </View>

          {comparisonBaselineJob?.metrics && (
            <View className='comparison-baseline-banner'>
              <View>
                <Text className='comparison-baseline-kicker'>前测已保存</Text>
                <Text className='comparison-baseline-text'>完成下一段同动作视频后自动生成对比</Text>
              </View>
              <View className='comparison-clear-btn' onClick={handleClearComparison}>
                <Text>清除</Text>
              </View>
            </View>
          )}

          <View className='pa-step'>
            <View className='pa-step__head'>
              <Text className='pa-step__index'>1</Text>
              <Text className='pa-step__title'>选择动作</Text>
            </View>
            {MODE_GROUPS.map((group) => (
              <View key={group.title} className='pa-mode-group'>
                <Text className='pa-mode-group__title'>{group.title}</Text>
                <View className='pa-mode-chips'>
                  {group.options.map((item) => (
                    <View
                      key={item.value}
                      className={`pa-mode-chip ${mode === item.value ? 'pa-mode-chip--active' : ''} ${settingsLocked ? 'pa-mode-chip--locked' : ''}`}
                      onClick={() => !settingsLocked && setMode(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <View className='pa-shoot-tip'>
              <Text className='pa-shoot-tip__label'>拍摄要点</Text>
              <Text className='pa-shoot-tip__text'>
                {isBarbell ? POWER_ANALYSIS_BARBELL_SHOOTING_TIP : isCustom ? POWER_ANALYSIS_CUSTOM_SHOOTING_TIP : selectedFormMode.hint}
              </Text>
            </View>
            {isCustom && (
              <View className='custom-name-cell'>
                <Text className='input-label'>动作名称</Text>
                <Input
                  className='metric-input custom-name-input'
                  type='text'
                  value={customActionName}
                  maxlength={POWER_ANALYSIS_CUSTOM_ACTION_NAME_MAX_LENGTH}
                  placeholder='例如：哑铃弯举、保加利亚分腿蹲'
                  disabled={settingsLocked}
                  onInput={(event) => setCustomActionName(String(event.detail.value || ''))}
                />
              </View>
            )}
          </View>

          <View className='pa-step'>
            <View className='pa-step__head'>
              <Text className='pa-step__index'>2</Text>
              <Text className='pa-step__title'>身体数据</Text>
              <Text className='pa-step__hint'>用来换算功率</Text>
            </View>
            <View className={`input-grid ${isBarbell ? 'input-grid-barbell' : ''}`}>
              <View className='input-cell'>
                <Text className='input-label'>身高 cm</Text>
                <Input
                  className='metric-input height-input'
                  type='digit'
                  value={heightCm}
                  disabled={settingsLocked}
                  onInput={(event) => setHeightCm(String(event.detail.value || ''))}
                />
              </View>
              <View className='input-cell'>
                <Text className='input-label'>体重 kg</Text>
                <Input
                  className='metric-input weight-input'
                  type='digit'
                  value={weightKg}
                  disabled={settingsLocked}
                  onInput={(event) => setWeightKg(String(event.detail.value || ''))}
                />
              </View>
              {isBarbell ? (
                <>
                  <View className='input-cell'>
                    <Text className='input-label'>杠铃总重 kg</Text>
                    <Input
                      className='metric-input barbell-input'
                      type='digit'
                      value={barbellKg}
                      disabled={settingsLocked}
                      onInput={(event) => setBarbellKg(String(event.detail.value || ''))}
                    />
                  </View>
                  <View className='input-cell'>
                    <Text className='input-label'>杠铃片直径 cm</Text>
                    <Input
                      className='metric-input plate-input'
                      type='digit'
                      value={plateDiameterCm}
                      disabled={settingsLocked}
                      onInput={(event) => setPlateDiameterCm(String(event.detail.value || ''))}
                    />
                  </View>
                </>
              ) : (
                <View className='input-cell'>
                  <Text className='input-label'>{isCustom ? '负重 kg（选填）' : '额外负重 kg'}</Text>
                  <Input
                    className='metric-input load-input'
                    type='digit'
                    value={externalLoadKg}
                    disabled={settingsLocked}
                    onInput={(event) => setExternalLoadKg(String(event.detail.value || ''))}
                  />
                </View>
              )}
            </View>
            {isBarbell && (
              <Text className='barbell-input-hint'>杠铃总重含杠铃杆和杠铃片；标准片直径 45 cm，请填写杠上最大那片的直径。</Text>
            )}
          </View>

          <View className='pa-step'>
            <View className='pa-step__head'>
              <Text className='pa-step__index'>3</Text>
              <Text className='pa-step__title'>上传视频</Text>
              <Text className='pa-step__hint'>选好后自动上传</Text>
            </View>

            <View className='video-picker'>
              {video ? (
                <View className='selected-video-wrap'>
                  <Video
                    id={SELECTED_VIDEO_ID}
                    className='selected-video'
                    src={video.tempFilePath}
                    controls
                    muted
                    objectFit='cover'
                    showFullscreenBtn={false}
                    title={video.name}
                  />
                  <View className='video-meta'>
                    <Text className='video-name'>{video.name}</Text>
                    <Text className='video-info'>
                      {formatFileSize(video.size)}
                      {formatDuration(video.duration) ? ` · ${formatDuration(video.duration)}` : ''}
                    </Text>
                    <View className='video-actions'>
                      <View className='preview-video-btn' onClick={handlePreviewVideo}>
                        <Text>全屏预览</Text>
                      </View>
                      <View className={`preview-video-btn ${isBusy ? 'disabled' : ''}`} onClick={handleChooseVideo}>
                        <Text>重新选择</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View className={`pa-empty-video ${isBusy ? 'disabled' : ''}`} onClick={handleChooseVideo}>
                  <Text className='pa-empty-video__plus'>+</Text>
                  <Text className='pa-empty-video__title'>选择训练视频</Text>
                  <Text className='pa-empty-video__desc'>
                    {entitlements.maxDurationSeconds} 秒内、最大 {entitlements.maxVideoSizeMb}MB；人物无遮挡、动作清晰
                  </Text>
                </View>
              )}
            </View>

            {(phase !== 'idle' || job) && (
              <View className='status-card'>
                <View className='status-row'>
                  <Text className='status-label'>{statusText}</Text>
                  <Text className='status-value'>{progressValue}%</Text>
                </View>
                <View className='progress-track'>
                  <View className='progress-fill' style={{ width: `${progressValue}%` }} />
                </View>
                {queueStatusText && <Text className='queue-status-text'>{queueStatusText}</Text>}
                {job?.errorMessage && <Text className='error-text'>{job.errorMessage}</Text>}
              </View>
            )}

            <View className='pa-more' onClick={() => setMoreSettingsOpen((open) => !open)}>
              <Text className='pa-more__label'>更多设置</Text>
              <Text className='pa-more__value'>
                {`${quality === 'original' ? '原画质' : '压缩画质'} · ${languagePreference === 'auto' ? '自动字幕' : languagePreference === 'zh' ? '中文字幕' : '英文字幕'}`}
              </Text>
              <Text className={`pa-more__caret ${moreSettingsOpen ? 'pa-more__caret--open' : ''}`}>›</Text>
            </View>
            {moreSettingsOpen && (
              <View className='pa-more-panel'>
                <View className='analysis-option-section'>
                  <View className='option-heading-row'>
                    <Text className='option-heading'>视频画质</Text>
                    <Text className='option-entitlement'>
                      {WECHAT_FREE_RELEASE ? '' : `${membershipLabel(entitlements.tier)} · `}最大 {entitlements.maxVideoSizeMb}MB
                    </Text>
                  </View>
                  <View className='quality-options'>
                    <View
                      className={`analysis-option ${quality === 'compressed' ? 'active' : ''}`}
                      onClick={() => handleQualityChange('compressed')}
                    >
                      <Text className='analysis-option-title'>压缩画质</Text>
                      <Text className='analysis-option-desc'>上传更快，适合日常测试</Text>
                    </View>
                    <View
                      className={`analysis-option ${quality === 'original' ? 'active' : ''} ${entitlements.canUseOriginalQuality ? '' : 'locked'}`}
                      onClick={() => handleQualityChange('original')}
                    >
                      <Text className='analysis-option-title'>原画质</Text>
                      <Text className='analysis-option-desc'>{WECHAT_FREE_RELEASE ? '保留分辨率与帧率' : '会员权益 · 保留分辨率与帧率'}</Text>
                    </View>
                  </View>
                </View>

                <View className='analysis-option-section'>
                  <Text className='option-heading'>结果视频字幕</Text>
                  <View className='language-options'>
                    {([
                      { value: 'auto', label: '自动' },
                      { value: 'zh', label: '中文' },
                      { value: 'en', label: 'English' }
                    ] as Array<{ value: OverlayLanguagePreference; label: string }>).map((item) => (
                      <View
                        key={item.value}
                        className={`language-option ${languagePreference === item.value ? 'active' : ''}`}
                        onClick={() => !settingsLocked && setLanguagePreference(item.value)}
                      >
                        <Text>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text className='language-hint'>自动模式当前将使用{overlayLanguage === 'zh' ? '中文' : '英文'}字幕</Text>
                </View>
              </View>
            )}
          </View>

          {job && (
          <View className='result-card'>
            <View className='result-header'>
              <View>
                <Text className='result-kicker'>{resultLabel}</Text>
                <Text className='section-title'>分析结果</Text>
              </View>
              <View className='result-actions'>
                {job?.status === 'done' && job.metrics && (
                  <View className='compare-next-btn' onClick={handleCompareNext}>
                    <Text>对比下一次</Text>
                  </View>
                )}
                <View className={`save-video-btn ${job?.canDownload && !savingVideo ? '' : 'disabled'}`} onClick={handleSaveVideo}>
                  <Text>{savingVideo ? '保存中' : downloadRetryAvailable ? '重新下载' : '保存视频'}</Text>
                </View>
              </View>
            </View>

            {!metrics ? (
              <View className='result-empty'>
                <Text>提交视频后，速度、功率、逐次数据和动作评估会显示在这里。</Text>
              </View>
            ) : (
              <View>
                <View className='summary-grid'>
                  {summaryTiles(metrics, resultIsBarbell).map((tile) => (
                    <View key={tile.label} className={`summary-item ${tile.accent ? 'accent' : ''}`}>
                      <Text className='summary-label'>{tile.label}</Text>
                      <Text className='summary-value'>{tile.value}</Text>
                    </View>
                  ))}
                </View>

                {typeof metrics.video?.inputHasAudio === 'boolean' && (
                  <View
                    className={`audio-status ${
                      metrics.video.inputHasAudio
                        ? metrics.video.audioPreserved
                          ? 'preserved'
                          : 'missing'
                        : ''
                    }`}
                  >
                    <Text>
                      {metrics.video.inputHasAudio
                        ? metrics.video.audioPreserved
                          ? '已保留原视频背景音效'
                          : '结果音轨异常，请重新分析'
                        : '上传视频未检测到音轨'}
                    </Text>
                  </View>
                )}

                {metrics.rating && (
                  <View className={`power-rating power-rating-${metrics.rating.level}`}>
                    <View>
                      <Text className='power-rating-kicker'>综合功率评级</Text>
                      <Text className='power-rating-title'>
                        {metrics.rating.labelZh} · {metrics.rating.labelEn}
                      </Text>
                    </View>
                    <Text className='power-rating-desc'>{metrics.rating.descriptionZh}</Text>
                    <Text className='power-rating-normalized'>
                      相对功率 {formatMetric(metrics.rating.normalizedPowerWPerKg, 2)} W/kg
                    </Text>
                  </View>
                )}

                {job?.ranking && (job.ranking.power.rank > 0 || job.ranking.speed.rank > 0) && (
                  <View className='power-challenge-card'>
                    <View className='power-challenge-header'>
                      <View>
                        <Text className='power-challenge-kicker'>全国功率挑战</Text>
                        <Text className='power-challenge-title'>你的真实视频成绩排名</Text>
                      </View>
                      <Text className='power-challenge-scope'>{job.ranking.scopeLabel}</Text>
                    </View>
                    <View className='power-challenge-grid'>
                      {job.ranking.power.rank > 0 && (
                        <View className='power-challenge-metric'>
                          <Text className='power-challenge-label'>最大功率榜</Text>
                          <Text className='power-challenge-rank'>第 {job.ranking.power.rank} 名</Text>
                          <Text className='power-challenge-value'>个人最好 {formatMetric(job.ranking.power.bestValue, 0)} W</Text>
                          <Text className='power-challenge-percentile'>
                            共 {job.ranking.power.participantTotal} 人 · 领先 {job.ranking.power.percentile}% 参赛者
                          </Text>
                        </View>
                      )}
                      {job.ranking.speed.rank > 0 && (
                        <View className='power-challenge-metric'>
                          <Text className='power-challenge-label'>最快速度榜</Text>
                          <Text className='power-challenge-rank'>第 {job.ranking.speed.rank} 名</Text>
                          <Text className='power-challenge-value'>个人最好 {formatMetric(job.ranking.speed.bestValue, 2)} m/s</Text>
                          <Text className='power-challenge-percentile'>
                            共 {job.ranking.speed.participantTotal} 人 · 领先 {job.ranking.speed.percentile}% 参赛者
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className='power-challenge-note'>
                      全国榜仅指 CoachLink 全国参赛用户；绝对功率会受体重、负重和动作类型影响。
                    </Text>
                    <View className='power-challenge-actions'>
                      <View
                        className='power-challenge-primary-btn'
                        onClick={() => Taro.navigateTo({
                          url: `/discovery/ranking/detail?id=${POWER_CHALLENGE_TEMPLATE_IDS.power}`
                        })}
                      >
                        <Text>查看功率榜</Text>
                      </View>
                      <View
                        className='power-challenge-secondary-btn'
                        onClick={() => Taro.navigateTo({
                          url: `/discovery/ranking/detail?id=${POWER_CHALLENGE_TEMPLATE_IDS.speed}`
                        })}
                      >
                        <Text>查看速度榜</Text>
                      </View>
                    </View>
                  </View>
                )}

                {metrics.timeSeries && metrics.timeSeries.length > 1 && (
                  <View className='power-curve-section'>
                    <View className='power-curve-header'>
                      <Text className='power-curve-title'>整段行程曲线</Text>
                      <Text className='power-curve-note'>覆盖完整视频时间轴</Text>
                    </View>
                    <View className='power-curve-block'>
                      <Text className='power-curve-subtitle'>速度曲线</Text>
                      <PowerCurveChart
                        points={metrics.timeSeries}
                        metric='velocityMps'
                        comparePoints={comparisonRows.length > 0 ? comparisonBaselineMetrics?.timeSeries : undefined}
                      />
                    </View>
                    <View className='power-curve-block'>
                      <Text className='power-curve-subtitle'>功率曲线</Text>
                      <PowerCurveChart
                        points={metrics.timeSeries}
                        metric='powerW'
                        comparePoints={comparisonRows.length > 0 ? comparisonBaselineMetrics?.timeSeries : undefined}
                      />
                    </View>
                    <View className='power-curve-block'>
                      <Text className='power-curve-subtitle'>位移曲线</Text>
                      <PowerCurveChart
                        points={metrics.timeSeries}
                        metric='displacementM'
                        comparePoints={comparisonRows.length > 0 ? comparisonBaselineMetrics?.timeSeries : undefined}
                      />
                    </View>
                  </View>
                )}

                <View className='rep-list'>
                  {metrics.reps.map((rep) => (
                    <View key={rep.repIndex} className='rep-row'>
                      <View className='rep-index'>
                        <Text>#{rep.repIndex}</Text>
                      </View>
                      {resultIsCustom ? (
                      <View className='rep-main'>
                        <Text className='rep-power'>{customRepText(metrics, rep).main}</Text>
                        <Text className='rep-detail'>{customRepText(metrics, rep).detail}</Text>
                      </View>
                      ) : (
                      <View className='rep-main'>
                        <Text className='rep-power'>
                          {resultIsBarbell
                            ? `平均速度 ${formatMetric(rep.meanVelocityMps, 2)} m/s · ${formatMetric(rep.avgPowerW, 0)} W`
                            : `${formatMetric(rep.avgPowerW, 0)} W · ${formatMetric(rep.horsepowerHp, 2)} hp`}
                        </Text>
                        <Text className='rep-detail'>
                          位移 {formatMetric(rep.displacementM, 2)} m · 上升 {formatMetric(rep.ascentTimeS, 2)} s · 最大速度 {formatMetric(rep.maxVelocityMps, 2)} m/s
                          {typeof rep.pauseS === 'number' ? ` · 停顿 ${formatMetric(rep.pauseS, 2)} s` : ''}
                        </Text>
                      </View>
                      )}
                    </View>
                  ))}
                </View>
                {resultIsCustom && (
                  <Text className='barbell-power-note'>
                    「{metrics.custom?.actionNameZh || '其他动作'}」按{metrics.custom?.primaryPartZh || '运动最大的部位'}计次，试验功能，不套用专项标准，不计算功率和评级。
                  </Text>
                )}
                {resultIsBarbell && (
                  <Text className='barbell-power-note'>
                    功率为杠铃抬升功率（杠铃总重 × g × 杠铃上升高度 ÷ 上升时间），只用来和自己同重量的记录比较，不代表力量水平。
                  </Text>
                )}
              </View>
            )}
          </View>
          )}

          <AssessmentSection
            assessment={metrics?.assessment}
            measurement={metrics?.measurement}
            canSeek={Boolean(video)}
            onSeek={handleSeekVideo}
          />

          {comparisonRows.length > 0 && comparisonBaselineMetrics && metrics && (
            <View className='comparison-card'>
              <View className='comparison-header'>
                <View>
                  <Text className='result-kicker'>前测 vs 后测</Text>
                  <Text className='section-title'>训练表现对比</Text>
                </View>
                <View className='comparison-clear-btn' onClick={handleClearComparison}>
                  <Text>结束对比</Text>
                </View>
              </View>
              <Text className={`comparison-verdict ${comparisonVerdict.includes('后测') ? 'improved' : ''}`}>
                {comparisonVerdict}
              </Text>
              <View className='comparison-table'>
                <View className='comparison-row comparison-row-head'>
                  <Text>指标</Text>
                  <Text>前测</Text>
                  <Text>后测</Text>
                  <Text>变化</Text>
                </View>
                {comparisonRows.map((row) => {
                  const delta = row.after - row.before
                  const improved = Math.abs(delta) > 0 && (row.higherIsBetter ? delta > 0 : delta < 0)
                  return (
                    <View key={row.key} className='comparison-row'>
                      <Text>{row.label}</Text>
                      <Text>{row.before.toFixed(row.digits)} {row.unit}</Text>
                      <Text>{row.after.toFixed(row.digits)} {row.unit}</Text>
                      <Text className={improved ? 'comparison-delta-improved' : 'comparison-delta'}>
                        {formatComparisonDelta(row)}
                      </Text>
                    </View>
                  )
                })}
              </View>
              <Text className='comparison-footnote'>曲线中的灰线是前测，彩色线是后测；视频时长不同时按各自完整进度对齐。</Text>
            </View>
          )}

          {(job?.status === 'done' || summaryLoading || job?.llmSummary) && (
          <View className='summary-card'>
            <View className='summary-header'>
              <Text className='section-title'>AI 解读</Text>
              {job?.status === 'done' && (
                <View className={`small-secondary-action ${summaryLoading ? 'disabled' : ''}`} onClick={() => job.id && generateSummary(job.id)}>
                  <Text>{summaryLoading ? '生成中' : '重新生成'}</Text>
                </View>
              )}
            </View>
            <Text className='summary-text'>
              {job?.llmSummary?.replace(/\*/g, '') ||
                (summaryLoading
                  ? '正在根据结构化指标生成解读...'
                  : '分析完成后，这里会给出训练建议。')}
            </Text>
          </View>
          )}
      </View>

      <View className='pa-footer'>
        <View className={`secondary-action reset-btn pa-footer__reset ${isBusy ? 'disabled' : ''}`} onClick={() => !isBusy && handleReset()}>
          <Text>重置</Text>
        </View>
        <View className={`primary-action start-analysis-btn pa-footer__start ${canSubmit ? '' : 'disabled'}`} onClick={handleStart}>
          <Text>{['creating', 'uploading'].includes(phase) ? '上传中' : isBusy ? '处理中' : video ? '开始分析' : '先选择视频'}</Text>
        </View>
      </View>
    </View>
  )
}
