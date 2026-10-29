import { useEffect, useMemo, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { apiClient, fetchWithTimeout, getStoredToken } from '../../api'
import { API_BASE_URL } from '../../config'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'

type Props = NativeStackScreenProps<RootStackParamList, 'PowerAnalysis'>
type PowerAnalysisMode = 'pullup' | 'muscleup' | 'dip' | 'pushup' | 'squat'
type PowerAnalysisJobStatus = 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
type UploadPhase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'
type PowerAnalysisQuality = 'compressed' | 'original'
type OverlayLanguage = 'zh' | 'en'
type CurveMetric = 'displacementM' | 'velocityMps' | 'powerW'

type PowerAnalysisRepMetric = {
  repIndex: number
  displacementM: number
  ascentTimeS: number
  avgPowerW: number
  horsepowerHp: number
  maxVelocityMps: number
}

type PowerAnalysisMetrics = {
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
  }
  reps: PowerAnalysisRepMetric[]
  timeSeries?: Array<{ timeS: number; displacementM: number; velocityMps: number; powerW: number }>
  rating?: {
    normalizedPowerWPerKg: number
    labelZh: string
    descriptionZh: string
  }
  video?: {
    audioPreserved?: boolean
    quality?: PowerAnalysisQuality
  }
  notes?: string[]
}

type PowerAnalysisJobDto = {
  id: string
  mode: PowerAnalysisMode
  heightCm: number
  weightKg: number
  externalLoadKg: number
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
}

type CreatePowerAnalysisUploadUrlResponseDto = {
  job: PowerAnalysisJobDto
  upload: { bucket: 'videos'; path: string; uploadUrl: string; token: string; expiresAt: string }
  limits: { maxVideoSizeMb: number; maxDurationSeconds: number; dailyLimit: number; canUseOriginalQuality: boolean; tier: string }
}

type PowerAnalysisDownloadUrlResponseDto = {
  url: string
  proxyUrl?: string
  expiresInSeconds: number
  filename: string
}

type SelectedVideo = {
  uri: string
  name: string
  contentType: string
  size: number
  duration?: number
}

type PowerAnalysisEntitlements = {
  tier: 'free' | 'basic' | 'premium' | 'trial'
  canUseOriginalQuality: boolean
  availableQualities: PowerAnalysisQuality[]
  maxVideoSizeMb: number
  maxDurationSeconds: number
  dailyLimit: number
}

const DEFAULT_ENTITLEMENTS: PowerAnalysisEntitlements = {
  tier: 'free',
  canUseOriginalQuality: false,
  availableQualities: ['compressed'],
  maxVideoSizeMb: 100,
  maxDurationSeconds: 30,
  dailyLimit: 5,
}
const LAST_DOWNLOADABLE_JOB_KEY = 'power-analysis-last-downloadable-job-v1'

const MODE_OPTIONS: Array<{ label: string; value: PowerAnalysisMode; hint: string }> = [
  { label: '引体向上', value: 'pullup', hint: '正面或侧前方，全身入镜' },
  { label: '双力臂', value: 'muscleup', hint: '保留过杠阶段，避免遮挡' },
  { label: '双杠臂屈伸', value: 'dip', hint: '肩、髋和双杠无遮挡' },
  { label: '俯卧撑', value: 'pushup', hint: '侧面拍摄，肩髋都要清楚' },
  { label: '深蹲起身', value: 'squat', hint: '侧前方全身，髋部可见' },
]

const TERMINAL_STATUSES: PowerAnalysisJobStatus[] = ['done', 'failed', 'expired']
const CURVE_OPTIONS: Array<{ value: CurveMetric; label: string }> = [
  { value: 'displacementM', label: '位移' },
  { value: 'velocityMps', label: '速度' },
  { value: 'powerW', label: '功率' },
]

function membershipLabel(tier: PowerAnalysisEntitlements['tier']) {
  if (tier === 'premium') return '高级会员'
  if (tier === 'basic') return '基础会员'
  if (tier === 'trial') return '试用权益'
  return '免费版'
}

function formatMetric(value: number | undefined, digits = 1) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toFixed(digits) : '0'
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '未知大小'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function inferVideoName(uri: string) {
  const cleanPath = String(uri || '').split('?')[0]
  const tail = cleanPath.split('/').pop() || ''
  if (/\.(mp4|mov|webm|mkv|avi)$/i.test(tail)) return tail
  return `power-analysis-${Date.now()}.mp4`
}

function inferContentType(filename: string, mimeType?: string | null) {
  if (mimeType) return mimeType
  const ext = String(filename || '').split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv') return 'video/x-matroska'
  if (ext === 'avi') return 'video/x-msvideo'
  return 'video/mp4'
}

async function uploadSignedVideo(params: { uploadUrl: string; uri: string; contentType: string; onProgress: (progress: number) => void }) {
  params.onProgress(8)
  const fileResponse = await fetch(params.uri)
  const blob = await fileResponse.blob()
  params.onProgress(30)
  const uploadResponse = await fetchWithTimeout(params.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': params.contentType },
    body: blob,
  }, 1_800_000)
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => '')
    throw new Error(text || `上传失败（${uploadResponse.status}）`)
  }
  params.onProgress(100)
}

function PowerCurve({ points, metric }: { points: NonNullable<PowerAnalysisMetrics['timeSeries']>; metric: CurveMetric }) {
  const values = points.map((point) => Number(point[metric] || 0))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(0.0001, max - min)
  const width = 300
  const height = 112
  const padding = 8
  const polyline = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const unit = metric === 'displacementM' ? 'm' : metric === 'velocityMps' ? 'm/s' : 'W'
  return (
    <View style={styles.curveWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={polyline} fill="none" stroke={colors.brand} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <View style={styles.curveLegend}>
        <Text style={styles.curveLegendText}>最低 {formatMetric(min, metric === 'powerW' ? 0 : 2)} {unit}</Text>
        <Text style={styles.curveLegendText}>最高 {formatMetric(max, metric === 'powerW' ? 0 : 2)} {unit}</Text>
      </View>
    </View>
  )
}

export function PowerAnalysisScreen({ navigation }: Props) {
  const { user } = useAuth()
  const userId = String(user?.id || '')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const llmRequestedRef = useRef<string | null>(null)
  const [mode, setMode] = useState<PowerAnalysisMode>('pullup')
  const [heightCm, setHeightCm] = useState('175')
  const [weightKg, setWeightKg] = useState('70')
  const [externalLoadKg, setExternalLoadKg] = useState('0')
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [job, setJob] = useState<PowerAnalysisJobDto | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [downloadHint, setDownloadHint] = useState('')
  const [entitlements, setEntitlements] = useState<PowerAnalysisEntitlements>(DEFAULT_ENTITLEMENTS)
  const [quality, setQuality] = useState<PowerAnalysisQuality>('compressed')
  const [overlayLanguage, setOverlayLanguage] = useState<OverlayLanguage>('zh')
  const [curveMetric, setCurveMetric] = useState<CurveMetric>('powerW')
  const [restoredJob, setRestoredJob] = useState(false)

  const selectedMode = useMemo(() => MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0], [mode])
  const metrics = job?.metrics || null
  const heightValue = Number(heightCm)
  const weightValue = Number(weightKg)
  const externalLoadValue = Number(externalLoadKg)
  const formReady = Number.isFinite(heightValue) && heightValue >= 100 && heightValue <= 250 && Number.isFinite(weightValue) && weightValue >= 30 && weightValue <= 250 && Number.isFinite(externalLoadValue) && externalLoadValue >= 0 && externalLoadValue <= 250
  const isBusy = ['creating', 'uploading', 'enqueueing', 'queued'].includes(phase) || job?.status === 'queued' || job?.status === 'processing'
  const settingsLocked = isBusy || phase === 'uploaded'
  const canSubmit = Boolean(video) && formReady && phase === 'uploaded' && job?.status === 'awaiting_upload'

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const generateSummary = async (jobId: string) => {
    setSummaryLoading(true)
    try {
      const next = await apiClient.request<PowerAnalysisJobDto>(`/api/toolbox/power-analysis/jobs/${jobId}/llm-summary`, { method: 'POST', timeoutMs: 20000 })
      setJob(next)
    } catch (e) {
      setDownloadHint((e as Error)?.message || 'AI 解读暂未生成，指标结果仍可查看')
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    if (!job?.id || job.status !== 'done' || job.llmSummary || llmRequestedRef.current === job.id) return
    llmRequestedRef.current = job.id
    generateSummary(job.id)
  }, [job?.id, job?.status, job?.llmSummary])

  const pollJob = (jobId: string) => {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      try {
        const next = await apiClient.request<PowerAnalysisJobDto>(`/api/toolbox/power-analysis/jobs/${jobId}`, { timeoutMs: 12000 })
        setJob(next)
        if (TERMINAL_STATUSES.includes(next.status)) {
          stopPolling()
          setPhase('done')
        }
      } catch (e) {
        setDownloadHint((e as Error)?.message || '状态刷新暂时失败，仍会继续尝试')
      }
    }, 1800)
  }

  useEffect(() => {
    let active = true
    async function restore() {
      try {
        const nextEntitlements = await apiClient.request<PowerAnalysisEntitlements>(
          '/api/toolbox/power-analysis/entitlements',
          { timeoutMs: 12000 },
        )
        if (active) {
          setEntitlements(nextEntitlements)
          if (!nextEntitlements.availableQualities.includes(quality)) setQuality('compressed')
        }
      } catch {
        if (active) setEntitlements(DEFAULT_ENTITLEMENTS)
      }

      if (!userId) return
      try {
        const raw = await AsyncStorage.getItem(LAST_DOWNLOADABLE_JOB_KEY)
        if (!raw || !active) return
        const stored = JSON.parse(raw)
        if (stored?.v !== 1 || String(stored.userId || '') !== userId || !stored.jobId) return
        const restored = await apiClient.request<PowerAnalysisJobDto>(
          `/api/toolbox/power-analysis/jobs/${stored.jobId}`,
          { timeoutMs: 12000 },
        )
        if (!active) return
        if (restored.status === 'done' && restored.canDownload) {
          setJob(restored)
          setMode(restored.mode)
          setHeightCm(String(restored.heightCm))
          setWeightKg(String(restored.weightKg))
          setExternalLoadKg(String(restored.externalLoadKg))
          setQuality(restored.quality || 'compressed')
          setOverlayLanguage(restored.overlayLanguage || 'zh')
          setPhase('done')
          setRestoredJob(true)
        } else if (restored.status === 'queued' || restored.status === 'processing') {
          setJob(restored)
          setPhase('queued')
          pollJob(restored.id)
        } else {
          await AsyncStorage.removeItem(LAST_DOWNLOADABLE_JOB_KEY)
        }
      } catch {
        await AsyncStorage.removeItem(LAST_DOWNLOADABLE_JOB_KEY)
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!userId || job?.status !== 'done' || !job.canDownload) return
    void AsyncStorage.setItem(LAST_DOWNLOADABLE_JOB_KEY, JSON.stringify({
      v: 1,
      userId,
      jobId: job.id,
    }))
  }, [job?.canDownload, job?.id, job?.status, userId])

  const prepareUpload = async (nextVideo: SelectedVideo) => {
    if (!formReady) {
      setError('请先填写有效的身高、体重和额外负重')
      return
    }
    const maxSizeBytes = entitlements.maxVideoSizeMb * 1024 * 1024
    if (nextVideo.size > 0 && nextVideo.size > maxSizeBytes) {
      setError(`当前等级最多支持 ${entitlements.maxVideoSizeMb}MB 视频`)
      return
    }
    const durationSeconds = Number(nextVideo.duration || 0) / 1000
    if (durationSeconds > entitlements.maxDurationSeconds) {
      setError(`当前等级最多支持 ${entitlements.maxDurationSeconds} 秒视频`)
      return
    }
    stopPolling()
    setError('')
    setDownloadHint('')
    setVideo(nextVideo)
    setJob(null)
    setUploadProgress(0)
    llmRequestedRef.current = null
    try {
      setPhase('creating')
      const created = await apiClient.request<CreatePowerAnalysisUploadUrlResponseDto>('/api/toolbox/power-analysis/create-upload-url', {
        method: 'POST',
        body: {
          mode,
          heightCm: heightValue,
          weightKg: weightValue,
          externalLoadKg: externalLoadValue,
          originalFilename: nextVideo.name,
          contentType: nextVideo.contentType,
          fileSizeBytes: nextVideo.size,
          durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
          quality,
          overlayLanguage,
        },
        timeoutMs: 15000,
      })
      setJob(created.job)
      setPhase('uploading')
      await uploadSignedVideo({ uploadUrl: created.upload.uploadUrl, uri: nextVideo.uri, contentType: nextVideo.contentType, onProgress: setUploadProgress })
      setPhase('uploaded')
    } catch (e) {
      setPhase('idle')
      setJob(null)
      setUploadProgress(0)
      setError((e as Error)?.message || '上传失败')
    }
  }

  const chooseVideo = async () => {
    if (isBusy) {
      setError('当前任务处理中')
      return
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('需要允许访问相册后才能选择视频')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: quality === 'original' ? 1 : 0.8, videoMaxDuration: entitlements.maxDurationSeconds })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const name = asset.fileName || inferVideoName(asset.uri)
    prepareUpload({
      uri: asset.uri,
      name,
      contentType: inferContentType(name, asset.mimeType),
      size: Number(asset.fileSize || 0),
      duration: Number(asset.duration || 0),
    })
  }

  const startAnalysis = async () => {
    if (!canSubmit || !job?.id) {
      setError('请先等待视频上传完成')
      return
    }
    stopPolling()
    llmRequestedRef.current = null
    setError('')
    try {
      setPhase('enqueueing')
      const queued = await apiClient.request<PowerAnalysisJobDto>(`/api/toolbox/power-analysis/jobs/${job.id}/enqueue`, { method: 'POST', timeoutMs: 15000 })
      setJob(queued)
      setPhase('queued')
      pollJob(queued.id)
    } catch (e) {
      setPhase('uploaded')
      setError((e as Error)?.message || '提交分析失败')
    }
  }

  const reset = () => {
    stopPolling()
    setVideo(null)
    setJob(null)
    setPhase('idle')
    setUploadProgress(0)
    setError('')
    setDownloadHint('')
    setRestoredJob(false)
    llmRequestedRef.current = null
  }

  const saveResultVideo = async () => {
    if (!job?.id || !job.canDownload) return
    setDownloading(true)
    setDownloadHint('')
    let fallbackUrl = ''
    try {
      const data = await apiClient.request<PowerAnalysisDownloadUrlResponseDto>(`/api/toolbox/power-analysis/jobs/${job.id}/download-url`, { method: 'POST', timeoutMs: 15000 })
      const url = data.proxyUrl ? `${API_BASE_URL.replace(/\/+$/, '')}${data.proxyUrl}` : data.url
      fallbackUrl = data.url || url
      const permission = await MediaLibrary.requestPermissionsAsync()
      if (!permission.granted) throw new Error('需要相册权限才能保存结果视频')
      const token = await getStoredToken()
      const safeFilename = String(data.filename || `coachlink-power-${job.id}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '-')
      const target = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${safeFilename}`
      const downloaded = await FileSystem.downloadAsync(url, target, {
        headers: data.proxyUrl && token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (downloaded.status !== 200) throw new Error(`下载失败（${downloaded.status}）`)
      await MediaLibrary.saveToLibraryAsync(downloaded.uri)
      setDownloadHint(`已保存到相册：${data.filename}`)
    } catch (e) {
      const message = (e as Error)?.message || '保存未完成'
      let fallbackCopied = false
      if (fallbackUrl) {
        try {
          await Clipboard.setStringAsync(fallbackUrl)
          fallbackCopied = true
        } catch {
          fallbackCopied = false
        }
      }
      setDownloadHint(fallbackUrl
        ? fallbackCopied
          ? `${message}；备用下载链接已复制，可再次重试。`
          : `${message}；备用下载链接复制失败，请稍后重试。`
        : message || '结果视频保存失败')
    } finally {
      setDownloading(false)
    }
  }

  const retryFailedJob = () => {
    if (!video) {
      reset()
      setDownloadHint('原视频已不在当前会话，请重新选择视频。')
      return
    }
    void prepareUpload(video)
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
    if (phase === 'uploaded' || phase === 'enqueueing') return 100
    if (phase === 'uploading') return uploadProgress
    if (phase === 'creating') return 5
    return 0
  })()

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>多动作功率测试</Text>
          <Text style={styles.heroTitle}>功率视频分析</Text>
          <Text style={styles.heroSubtitle}>上传自重或负重动作视频，估算功率、马力、最大速度，并生成带实时标注的视频结果。</Text>
        </View>
        <View style={styles.heroIcon}><IconFont name="icon-video" color={colors.brand} size={30} /></View>
      </View>

      {restoredJob ? (
        <View style={styles.restoreBanner}>
          <IconFont name="icon-time" color="#087A63" size={18} />
          <View style={styles.restoreMain}>
            <Text style={styles.restoreTitle}>已恢复上次可下载结果</Text>
            <Text style={styles.restoreText}>结果视频仍在有效期内，可继续查看指标或保存到相册。</Text>
          </View>
        </View>
      ) : null}

      <SectionCard title="测试设置" description="视频仅作为临时分析任务处理，默认最多保留 24 小时。">
        <View style={styles.entitlementCard}>
          <View>
            <Text style={styles.entitlementTitle}>{membershipLabel(entitlements.tier)}</Text>
            <Text style={styles.entitlementMeta}>每日 {entitlements.dailyLimit} 次 · 最大 {entitlements.maxVideoSizeMb}MB · {entitlements.maxDurationSeconds} 秒</Text>
          </View>
          <View style={styles.entitlementBadge}><Text style={styles.entitlementBadgeText}>{entitlements.canUseOriginalQuality ? '支持原画' : '压缩画质'}</Text></View>
        </View>

        <Text style={styles.optionLabel}>输出画质</Text>
        <View style={styles.optionRow}>
          <Pressable disabled={settingsLocked} onPress={() => setQuality('compressed')} style={[styles.optionChip, quality === 'compressed' && styles.optionChipActive]}>
            <Text style={[styles.optionText, quality === 'compressed' && styles.optionTextActive]}>压缩画质</Text>
          </Pressable>
          <Pressable disabled={settingsLocked || !entitlements.canUseOriginalQuality} onPress={() => entitlements.canUseOriginalQuality && setQuality('original')} style={[styles.optionChip, quality === 'original' && styles.optionChipActive, !entitlements.canUseOriginalQuality && styles.disabled]}>
            <Text style={[styles.optionText, quality === 'original' && styles.optionTextActive]}>原画质{!entitlements.canUseOriginalQuality ? ' · 会员' : ''}</Text>
          </Pressable>
        </View>

        <Text style={styles.optionLabel}>视频标注语言</Text>
        <View style={styles.optionRow}>
          {([['zh', '中文'], ['en', 'English']] as const).map(([value, label]) => (
            <Pressable key={value} disabled={settingsLocked} onPress={() => setOverlayLanguage(value)} style={[styles.optionChip, overlayLanguage === value && styles.optionChipActive]}>
              <Text style={[styles.optionText, overlayLanguage === value && styles.optionTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.modeGrid}>
          {MODE_OPTIONS.map((item) => {
            const active = mode === item.value
            return (
              <Pressable key={item.value} disabled={settingsLocked} onPress={() => setMode(item.value)} style={[styles.modeCard, active && styles.modeCardActive, settingsLocked && styles.disabled]}>
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{item.label}</Text>
                <Text style={[styles.modeHint, active && styles.modeHintActive]}>{item.hint}</Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.formGrid}>
          <MetricInput label="身高" suffix="cm" value={heightCm} disabled={settingsLocked} onChangeText={setHeightCm} />
          <MetricInput label="体重" suffix="kg" value={weightKg} disabled={settingsLocked} onChangeText={setWeightKg} />
          <MetricInput label="额外负重" suffix="kg" value={externalLoadKg} disabled={settingsLocked} onChangeText={setExternalLoadKg} />
        </View>
      </SectionCard>

      <SectionCard title="视频上传">
        <Pressable disabled={isBusy} onPress={chooseVideo} style={[styles.uploadBox, isBusy && styles.disabled]}>
          <IconFont name="icon-video" color={colors.brand} size={28} />
          <Text style={styles.uploadTitle}>{video ? video.name : '选择视频后自动上传'}</Text>
          <Text style={styles.uploadMeta}>{video ? `${formatFileSize(video.size)}${video.duration ? ` · ${Math.round(video.duration / 1000)} 秒` : ''}` : `支持相册视频，当前上限 ${entitlements.maxDurationSeconds} 秒 / ${entitlements.maxVideoSizeMb}MB`}</Text>
        </Pressable>
        <View style={styles.progressCard}>
          <View style={styles.progressTop}><Text style={styles.progressTitle}>{statusText}</Text><Text style={styles.progressValue}>{progressValue}%</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressValue}%` }]} /></View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {job?.queueInfo && (job.status === 'queued' || job.status === 'processing') ? (
          <Text style={styles.queueText}>队列前方 {job.queueInfo.jobsAhead} 个任务（处理中 {job.queueInfo.processingAhead}，等待 {job.queueInfo.queuedAhead}）</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={reset} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>重置</Text></Pressable>
          <Pressable onPress={startAnalysis} disabled={!canSubmit} style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}>
            <Text style={styles.primaryButtonText}>{isBusy ? '处理中' : '开始分析'}</Text>
          </Pressable>
        </View>
        {job?.status === 'failed' || job?.status === 'expired' ? (
          <Pressable onPress={retryFailedJob} style={styles.retryButton}><Text style={styles.retryText}>重新上传并分析</Text></Pressable>
        ) : null}
      </SectionCard>

      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View><Text style={styles.resultKicker}>{selectedMode.label}</Text><Text style={styles.resultTitle}>分析结果</Text></View>
          <Pressable onPress={saveResultVideo} disabled={!job?.canDownload || downloading} style={[styles.downloadButton, (!job?.canDownload || downloading) && styles.buttonDisabled]}>
            {downloading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.downloadText}>保存到相册</Text>}
          </Pressable>
        </View>
        {!metrics ? (
          <Text style={styles.emptyText}>提交视频后，功率、马力、最大速度和逐次数据会显示在这里。</Text>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="有效次数" value={`${metrics.repCount}`} />
              <MetricCard label="最高功率" value={`${formatMetric(metrics.summary.bestPowerW, 0)} W`} />
              <MetricCard label="最高马力" value={`${formatMetric(metrics.summary.bestHorsepowerHp, 2)} hp`} brand />
              <MetricCard label="最快速度" value={`${formatMetric(metrics.summary.bestVelocityMps, 2)} m/s`} />
            </View>
            {metrics.rating ? (
              <View style={styles.ratingCard}>
                <View style={styles.ratingTop}><Text style={styles.ratingTitle}>{metrics.rating.labelZh}</Text><Text style={styles.ratingValue}>{formatMetric(metrics.rating.normalizedPowerWPerKg, 2)} W/kg</Text></View>
                <Text style={styles.ratingDescription}>{metrics.rating.descriptionZh}</Text>
              </View>
            ) : null}
            {metrics.timeSeries && metrics.timeSeries.length > 1 ? (
              <View style={styles.curveCard}>
                <Text style={styles.curveTitle}>动作时序曲线</Text>
                <View style={styles.curveTabs}>
                  {CURVE_OPTIONS.map((option) => (
                    <Pressable key={option.value} onPress={() => setCurveMetric(option.value)} style={[styles.curveTab, curveMetric === option.value && styles.curveTabActive]}>
                      <Text style={[styles.curveTabText, curveMetric === option.value && styles.curveTabTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <PowerCurve points={metrics.timeSeries} metric={curveMetric} />
              </View>
            ) : null}
            <View style={styles.repList}>
              {metrics.reps.map((rep) => (
                <View key={rep.repIndex} style={styles.repRow}>
                  <Text style={styles.repIndex}>#{rep.repIndex}</Text>
                  <Text style={styles.repText}>{formatMetric(rep.displacementM, 2)}m</Text>
                  <Text style={styles.repText}>{formatMetric(rep.ascentTimeS, 2)}s</Text>
                  <Text style={styles.repText}>{formatMetric(rep.avgPowerW, 0)}W</Text>
                  <Text style={styles.repText}>{formatMetric(rep.maxVelocityMps, 2)}m/s</Text>
                </View>
              ))}
            </View>
            {metrics.video?.audioPreserved !== undefined ? (
              <View style={styles.audioStatus}><IconFont name="icon-video" color={metrics.video.audioPreserved ? '#087A63' : colors.textMuted} size={16} /><Text style={styles.audioText}>{metrics.video.audioPreserved ? '结果视频已保留原音频' : '结果视频不含原音频'}</Text></View>
            ) : null}
            {job?.llmSummary ? <Text style={styles.summaryText}>{job.llmSummary}</Text> : summaryLoading ? <Text style={styles.emptyText}>正在生成 AI 解读...</Text> : null}
          </>
        )}
        {job?.errorMessage ? <Text style={styles.errorText}>{job.errorMessage}</Text> : null}
        {downloadHint ? <Text style={styles.hintText}>{downloadHint}</Text> : null}
      </View>
    </Page>
  )
}

function MetricInput({ label, suffix, value, disabled, onChangeText }: { label: string; suffix: string; value: string; disabled?: boolean; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldSuffix}>{suffix}</Text></View>
      <TextInput value={value} editable={!disabled} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder="输入数值" placeholderTextColor={colors.textMuted} style={styles.input} />
    </View>
  )
}

function MetricCard({ label, value, brand }: { label: string; value: string; brand?: boolean }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, brand && styles.metricValueBrand]}>{value}</Text></View>
}

const styles = StyleSheet.create({
  backRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hero: { minHeight: 168, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroText: { flex: 1, gap: spacing.xs },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  restoreBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#E9F8F3', borderWidth: 1, borderColor: '#B9E6D8' },
  restoreMain: { flex: 1, gap: 4 },
  restoreTitle: { color: '#087A63', fontSize: 14, fontWeight: '700' },
  restoreText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  entitlementCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  entitlementTitle: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  entitlementMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  entitlementBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  entitlementBadgeText: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  optionLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: spacing.xs },
  optionRow: { flexDirection: 'row', gap: spacing.xs },
  optionChip: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  optionChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: '#FFFFFF' },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  modeCard: { width: '48%', minHeight: 88, borderRadius: radius.lg, padding: spacing.sm, justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  modeCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  modeLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  modeLabelActive: { color: '#FFFFFF' },
  modeHint: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  modeHintActive: { color: 'rgba(255,255,255,0.78)' },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  field: { gap: spacing.xs },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  fieldSuffix: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 16, fontWeight: '600', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  uploadBox: { minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: spacing.sm },
  uploadTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  uploadMeta: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  progressCard: { borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surfaceMuted, marginTop: spacing.sm },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  progressValue: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.border },
  progressFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.58 },
  buttonDisabled: { opacity: 0.5 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: spacing.xs },
  queueText: { color: colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  retryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.brand },
  retryText: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  resultCard: { borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  resultKicker: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  resultTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  downloadButton: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F1F1F' },
  downloadText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '47%', borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surfaceMuted },
  metricLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  metricValueBrand: { color: colors.brand },
  ratingCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  ratingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  ratingTitle: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  ratingValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  ratingDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  curveCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  curveTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  curveTabs: { flexDirection: 'row', gap: spacing.xs },
  curveTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface },
  curveTabActive: { backgroundColor: colors.brand },
  curveTabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  curveTabTextActive: { color: '#FFFFFF' },
  curveWrap: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  curveLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  curveLegendText: { color: colors.textTertiary, fontSize: 10 },
  repList: { gap: spacing.xs },
  repRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted },
  repIndex: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  repText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  summaryText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.brandSoft },
  audioStatus: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  audioText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  hintText: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
})
