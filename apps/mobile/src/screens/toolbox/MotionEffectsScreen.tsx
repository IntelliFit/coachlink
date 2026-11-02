import { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { apiClient, getStoredToken } from '../../api'
import { NativeVideoPlayer } from '../../components/NativeMedia'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { API_BASE_URL } from '../../config'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, shadow, spacing } from '../../theme'
import {
  getMotionEffectProgress,
  getMotionEffectStatusText,
  validateMotionEffectVideo,
  type MotionEffectJobStatus,
  type MotionEffectLimits,
  type MotionEffectUploadPhase,
  GLOW_STRENGTH_OPTIONS,
  MOTION_SPEED_OPTIONS,
  MOTION_STYLE_OPTIONS,
  SURFACE_DENSITY_OPTIONS,
  canReleaseMotionJob,
  formatMotionPrice,
  isMotionJobPaymentLocked,
  motionRestorePlan,
  shouldRememberMotionJob,
  type ExportQuality,
  type GlowStrength,
  type MotionSpeed,
  type SurfaceDensity,
} from './motionEffectsModel'

type Props = NativeStackScreenProps<RootStackParamList, 'MotionEffects'>

type MotionEffectJob = {
  id: string
  status: MotionEffectJobStatus
  progress: number
  result: {
    analyzedFrames: number
    handFrames: number
    peakPairs: number
    pairFrameCounts: number[]
    durationSeconds: number
    audioPreserved: boolean
  } | null
  errorMessage: string | null
  expiresAt: string
  createdAt: string
  completedAt: string | null
  canDownload: boolean
  paymentStatus?: string
  priceCents?: number
  exportQuality?: ExportQuality
  queueTier?: 'standard' | 'priority'
  styleKey?: string
  motionSpeed?: MotionSpeed
  glowStrength?: GlowStrength
  surfaceDensity?: SurfaceDensity
  queueInfo?: { jobsAhead: number; queuedAhead: number; processingAhead: number; totalQueued: number } | null
}

type CreateMotionEffectResponse = {
  job: MotionEffectJob
  limits: MotionEffectLimits
}

type MotionEffectCheckout = {
  job: MotionEffectJob
  order: { id: string; totalAmountCents: number; status: string }
  paymentInfo: { provider?: string; paymentUrl?: string }
}

type MotionEffectDownload = {
  url: string
  proxyUrl?: string
  signedUrl?: string
  expiresInSeconds: number
  filename: string
}

type SelectedVideo = {
  uri: string
  name: string
  contentType: string
  size: number
  durationSeconds: number
}

const DEFAULT_LIMITS = { maxVideoSizeMb: 100, maxDurationSeconds: 30, dailyLimit: 5 }
const LAST_JOB_KEY = 'motion-effects-last-job-v1'
const PAYMENT_RECHECK_TIMES = 2
const PAYMENT_RECHECK_MS = 2000
const TERMINAL_STATUSES: MotionEffectJobStatus[] = ['done', 'failed', 'expired']

function inferVideoName(uri: string) {
  const tail = String(uri || '').split('?')[0].split('/').pop() || ''
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(tail) ? tail : `coachlink-motion-${Date.now()}.mp4`
}

function inferContentType(filename: string, mimeType?: string | null) {
  if (mimeType) return mimeType
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv') return 'video/x-matroska'
  if (ext === 'avi') return 'video/x-msvideo'
  return 'video/mp4'
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '未知大小'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function parseUploadResponse(body: string, status: number) {
  let payload: { success?: boolean; message?: string; data?: unknown } | null = null
  try {
    payload = JSON.parse(body)
  } catch {
    payload = null
  }
  if (status < 200 || status >= 300 || !payload?.success) {
    throw new Error(payload?.message || `上传失败（${status}）`)
  }
}

export function MotionEffectsScreen({ navigation }: Props) {
  const { isAuthenticated, user } = useAuth()
  const userId = String(user?.id || '')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const uploadTaskRef = useRef<FileSystem.UploadTask | null>(null)
  const pollErrorCountRef = useRef(0)
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [job, setJob] = useState<MotionEffectJob | null>(null)
  const [phase, setPhase] = useState<MotionEffectUploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [limits, setLimits] = useState(DEFAULT_LIMITS)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoredJob, setRestoredJob] = useState(false)
  const [exportQuality, setExportQuality] = useState<ExportQuality>('standard')
  const [styleKey, setStyleKey] = useState(MOTION_STYLE_OPTIONS[0].key)
  const [motionSpeed, setMotionSpeed] = useState<MotionSpeed>('balanced')
  const [glowStrength, setGlowStrength] = useState<GlowStrength>('balanced')
  const [surfaceDensity, setSurfaceDensity] = useState<SurfaceDensity>('balanced')
  const [checkout, setCheckout] = useState<MotionEffectCheckout | null>(null)
  const [paying, setPaying] = useState(false)
  const paymentOpenedRef = useRef(false)
  const checkingPaymentRef = useRef(false)
  const mountedRef = useRef(true)
  // 随任务一起记在本地，重新打开页面或 APP 被杀后靠它们接上
  const uploadedJobIdRef = useRef('')
  const orderIdRef = useRef('')

  // 规格和效果在上传时确定，选好视频后锁定
  const optionsLocked = phase !== 'idle' || Boolean(job)

  const stopPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopPolling()
      void uploadTaskRef.current?.cancelAsync().catch(() => undefined)
    }
  }, [])

  const rememberJob = (jobId: string) => AsyncStorage.setItem(LAST_JOB_KEY, JSON.stringify({
    v: 1,
    userId,
    jobId,
    uploaded: uploadedJobIdRef.current === jobId,
    orderId: orderIdRef.current || undefined,
  })).catch(() => undefined)

  /** 上传失败或换视频时释放名额，否则服务端最多占 1 小时，期间新视频都传不了。 */
  const releaseUnpaidJob = async (target: MotionEffectJob | null) => {
    if (!target || !canReleaseMotionJob(target)) return
    await apiClient.request(`/api/toolbox/motion-effects/jobs/${target.id}/cancel`, { method: 'POST', timeoutMs: 10000 }).catch(() => undefined)
  }

  const applyJobOptions = (target: MotionEffectJob) => {
    if (target.exportQuality) setExportQuality(target.exportQuality)
    if (target.styleKey) setStyleKey(target.styleKey)
    if (target.motionSpeed) setMotionSpeed(target.motionSpeed)
    if (target.glowStrength) setGlowStrength(target.glowStrength)
    if (target.surfaceDensity) setSurfaceDensity(target.surfaceDensity)
  }

  const ensureDownloadUrl = async (jobId: string) => {
    const data = await apiClient.request<MotionEffectDownload>(`/api/toolbox/motion-effects/jobs/${jobId}/download-url`, {
      method: 'POST',
      timeoutMs: 15000,
    })
    setPreviewUrl(data.url)
    return data
  }

  const pollJob = (jobId: string) => {
    stopPolling()
    pollErrorCountRef.current = 0
    pollTimerRef.current = setInterval(async () => {
      try {
        const current = await apiClient.request<MotionEffectJob>(`/api/toolbox/motion-effects/jobs/${jobId}`, { timeoutMs: 12000 })
        pollErrorCountRef.current = 0
        setJob(current)
        setHint('')
        if (TERMINAL_STATUSES.includes(current.status)) {
          stopPolling()
          setPhase('done')
          if (current.status === 'done') {
            await ensureDownloadUrl(current.id)
          }
        }
      } catch (nextError) {
        pollErrorCountRef.current += 1
        setHint((nextError as Error)?.message || '任务状态刷新失败，正在重试')
        if (pollErrorCountRef.current >= 3) {
          stopPolling()
          setHint('连续刷新失败。任务仍在云端，可点击“继续刷新”恢复进度。')
        }
      }
    }, 1800)
  }

  useEffect(() => {
    let active = true
    async function restore() {
      if (!userId) return
      try {
        const raw = await AsyncStorage.getItem(LAST_JOB_KEY)
        if (!raw || !active) return
        const stored = JSON.parse(raw)
        if (stored?.v !== 1 || String(stored.userId || '') !== userId || !stored.jobId) return
        const current = await apiClient.request<MotionEffectJob>(`/api/toolbox/motion-effects/jobs/${stored.jobId}`, { timeoutMs: 12000 })
        if (!active) return
        uploadedJobIdRef.current = stored.uploaded ? current.id : ''
        orderIdRef.current = String(stored.orderId || '')
        const plan = motionRestorePlan(current, Boolean(stored.uploaded))
        if (plan === 'forget' || plan === 'release') {
          if (plan === 'release') await releaseUnpaidJob(current)
          await AsyncStorage.removeItem(LAST_JOB_KEY)
          return
        }
        setJob(current)
        applyJobOptions(current)
        setRestoredJob(true)
        if (plan === 'poll') {
          setPhase('queued')
          pollJob(current.id)
        } else if (plan === 'done') {
          setPhase('done')
          await ensureDownloadUrl(current.id)
        } else if (plan === 'retry') {
          setPhase('done')
        } else {
          uploadedJobIdRef.current = current.id
          setPhase('uploaded')
          if (plan === 'confirmPayment') {
            if (orderIdRef.current) {
              setCheckout({ job: current, order: { id: orderIdRef.current, totalAmountCents: Number(current.priceCents) || 0, status: 'pending' }, paymentInfo: {} })
            }
            await checkPayment(current.id, true)
          }
        }
      } catch (restoreError) {
        // 网络失败不能忘记任务，里面可能有已付款的订单；只有任务确实不存在才清掉
        if ((restoreError as { status?: number })?.status === 404) await AsyncStorage.removeItem(LAST_JOB_KEY)
      }
    }
    void restore()
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!userId || !job?.id || !shouldRememberMotionJob(job)) return
    void rememberJob(job.id)
  }, [job?.id, job?.status, job?.paymentStatus, phase, checkout?.order.id, userId])

  const uploadVideo = async (nextVideo: SelectedVideo, jobId: string) => {
    const token = await getStoredToken()
    if (!token) throw new Error('登录状态已失效，请重新登录')
    const endpoint = `${API_BASE_URL.replace(/\/+$/, '')}/api/toolbox/motion-effects/jobs/${encodeURIComponent(jobId)}/upload`
    const task = FileSystem.createUploadTask(endpoint, nextVideo.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: nextVideo.contentType,
      headers: { Authorization: `Bearer ${token}` },
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    }, ({ totalBytesExpectedToSend, totalBytesSent }) => {
      const total = Math.max(1, Number(totalBytesExpectedToSend || nextVideo.size || 1))
      setUploadProgress(Math.max(1, Math.min(99, Math.round((totalBytesSent / total) * 100))))
    })
    uploadTaskRef.current = task
    const result = await task.uploadAsync()
    uploadTaskRef.current = null
    if (!result) throw new Error('上传已取消')
    parseUploadResponse(result.body, result.status)
    setUploadProgress(100)
  }

  const prepareUpload = async (nextVideo: SelectedVideo) => {
    const validationError = validateMotionEffectVideo(nextVideo, limits)
    if (validationError) {
      setError(validationError)
      return
    }
    stopPolling()
    const previousJob = job
    let createdJob: MotionEffectJob | null = null
    setVideo(nextVideo)
    setJob(null)
    setPreviewUrl('')
    setError('')
    setHint('')
    setRestoredJob(false)
    setUploadProgress(0)
    uploadedJobIdRef.current = ''
    orderIdRef.current = ''
    try {
      setPhase('creating')
      await releaseUnpaidJob(previousJob)
      const created = await apiClient.request<CreateMotionEffectResponse>('/api/toolbox/motion-effects/create-upload-url', {
        method: 'POST',
        body: {
          originalFilename: nextVideo.name,
          contentType: nextVideo.contentType,
          fileSizeBytes: nextVideo.size,
          durationSeconds: nextVideo.durationSeconds || undefined,
          exportQuality,
          styleKey,
          bgmKey: 'original',
          motionSpeed,
          glowStrength,
          surfaceDensity,
        },
        timeoutMs: 15000,
      })
      setLimits(created.limits)
      createdJob = created.job
      setJob(created.job)
      setPhase('uploading')
      await uploadVideo(nextVideo, created.job.id)
      uploadedJobIdRef.current = created.job.id
      setPhase('uploaded')
      setHint('视频已安全上传，可以开始生成。')
    } catch (nextError) {
      setPhase('idle')
      setJob(null)
      setUploadProgress(0)
      setError((nextError as Error)?.message || '视频上传失败')
      await releaseUnpaidJob(createdJob)
      await AsyncStorage.removeItem(LAST_JOB_KEY).catch(() => undefined)
    }
  }

  const chooseVideo = async () => {
    if (!isAuthenticated) {
      setError('登录后可以生成并保存特效视频。')
      navigation.navigate('Login')
      return
    }
    if (['creating', 'uploading', 'enqueueing', 'queued'].includes(phase) || job?.status === 'processing') {
      setError('当前任务处理中，请等待完成后再选择新视频')
      return
    }
    if (isMotionJobPaymentLocked(job)) {
      setError('这个视频已发起付款，请先完成付款。不付款的话，最多 1 小时后可以重新选择。')
      return
    }
    if (job?.status === 'failed' && job.paymentStatus === 'paid') {
      setError('这次已付款，可以点「免费重新生成」。不想再试的话，先点「重新选择」。')
      return
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('需要允许访问相册后才能选择视频')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.72,
      videoMaxDuration: limits.maxDurationSeconds,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const name = asset.fileName || inferVideoName(asset.uri)
    let size = Number(asset.fileSize || 0)
    if (size <= 0) {
      const info = await FileSystem.getInfoAsync(asset.uri)
      size = info.exists ? Number(info.size || 0) : 0
    }
    void prepareUpload({
      uri: asset.uri,
      name,
      contentType: inferContentType(name, asset.mimeType),
      size,
      durationSeconds: Number(asset.duration || 0) / 1000,
    })
  }

  /** 先让服务端向支付宝查一次，支付宝的异步通知可能还没到。 */
  const queryPaymentStatus = async (jobId: string) => {
    if (orderIdRef.current) {
      await apiClient.request('/api/payment/alipay/query', { method: 'POST', body: { orderId: orderIdRef.current }, timeoutMs: 12000 }).catch(() => undefined)
    }
    return apiClient.request<MotionEffectJob>(`/api/toolbox/motion-effects/jobs/${jobId}/payment-status`, { timeoutMs: 12000 })
  }

  /** 付款成功才开始生成；付款结果以服务端为准。quiet 是自动查询，结果没到时多等几次。 */
  const checkPayment = async (jobId: string, quiet = false) => {
    if (checkingPaymentRef.current) return
    checkingPaymentRef.current = true
    setPaying(true)
    try {
      let current = await queryPaymentStatus(jobId)
      for (let attempt = 0; quiet && current.paymentStatus !== 'paid' && attempt < PAYMENT_RECHECK_TIMES; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, PAYMENT_RECHECK_MS))
        if (!mountedRef.current) return
        current = await queryPaymentStatus(jobId)
      }
      if (!mountedRef.current) return
      setJob(current)
      if (current.paymentStatus === 'paid') {
        paymentOpenedRef.current = false
        setCheckout(null)
        await enqueueJob(jobId)
      } else if (current.status === 'failed') {
        setCheckout(null)
        setPhase('done')
        await AsyncStorage.removeItem(LAST_JOB_KEY).catch(() => undefined)
      } else {
        setHint(quiet ? '支付结果还在确认中。付款完成后可以点「刷新支付状态」。' : '暂未收到支付结果，请稍后再试')
      }
    } catch (statusError) {
      if (!quiet) setError((statusError as Error)?.message || '支付状态查询失败')
      else setHint('支付结果查询失败，可以点「刷新支付状态」重试。')
    } finally {
      checkingPaymentRef.current = false
      if (mountedRef.current) setPaying(false)
    }
  }

  // 从支付宝回到 APP 时自动查询付款结果
  const pendingCheckoutJobId = checkout?.job.id
  useEffect(() => {
    if (!pendingCheckoutJobId) return undefined
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && paymentOpenedRef.current) void checkPayment(pendingCheckoutJobId, true)
    })
    return () => subscription.remove()
  }, [pendingCheckoutJobId])

  const startGeneration = async () => {
    if (!job?.id || phase !== 'uploaded') {
      setError('请先选择并上传视频')
      return
    }
    await enqueueJob(job.id)
  }

  const enqueueJob = async (jobId: string) => {
    setError('')
    setHint('')
    try {
      setPhase('enqueueing')
      const queued = await apiClient.request<MotionEffectJob>(`/api/toolbox/motion-effects/jobs/${jobId}/enqueue`, {
        method: 'POST',
        timeoutMs: 15000,
      })
      setJob(queued)
      setPhase('queued')
      pollJob(queued.id)
    } catch (nextError) {
      setPhase('uploaded')
      setError((nextError as Error)?.message || '提交生成任务失败')
    }
  }

  const saveResult = async () => {
    if (!job?.id || !job.canDownload) return
    setSaving(true)
    setHint('')
    let fallbackUrl = ''
    try {
      const data = await ensureDownloadUrl(job.id)
      const url = data.proxyUrl ? `${API_BASE_URL.replace(/\/+$/, '')}${data.proxyUrl}` : data.url
      fallbackUrl = data.url || url
      const permission = await MediaLibrary.requestPermissionsAsync()
      if (!permission.granted) throw new Error('需要相册权限才能保存结果视频')
      const token = await getStoredToken()
      const safeFilename = String(data.filename || `coachlink-motion-${job.id}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '-')
      const target = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${safeFilename}`
      const downloaded = await FileSystem.downloadAsync(url, target, {
        headers: data.proxyUrl && token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (downloaded.status !== 200) throw new Error(`下载失败（${downloaded.status}）`)
      await MediaLibrary.saveToLibraryAsync(downloaded.uri)
      setHint(`已保存到相册：${data.filename}`)
    } catch (nextError) {
      const message = (nextError as Error)?.message || '保存未完成'
      let fallbackCopied = false
      if (fallbackUrl) {
        try {
          await Clipboard.setStringAsync(fallbackUrl)
          fallbackCopied = true
        } catch {
          fallbackCopied = false
        }
      }
      setHint(fallbackUrl
        ? fallbackCopied
          ? `${message}；备用下载链接已复制。`
          : `${message}；备用下载链接复制失败，请稍后重试。`
        : message || '结果视频保存失败')
    } finally {
      setSaving(false)
    }
  }

  const clearCurrentJob = () => {
    const previousJob = job
    stopPolling()
    setVideo(null)
    setJob(null)
    setPhase('idle')
    setUploadProgress(0)
    setPreviewUrl('')
    setError('')
    setHint('')
    setRestoredJob(false)
    setCheckout(null)
    paymentOpenedRef.current = false
    uploadedJobIdRef.current = ''
    orderIdRef.current = ''
    void AsyncStorage.removeItem(LAST_JOB_KEY).catch(() => undefined)
    void releaseUnpaidJob(previousJob)
  }

  const reset = () => {
    if (job?.status === 'failed' && job.paymentStatus === 'paid') {
      Alert.alert('放弃这次付款？', '这次已付款，可以免费重新生成。放弃后不会自动退款，需要联系客服处理。', [
        { text: '继续重试', style: 'cancel' },
        { text: '放弃', style: 'destructive', onPress: clearCurrentJob },
      ])
      return
    }
    clearCurrentJob()
  }

  const statusInput = { phase, uploadProgress, jobStatus: job?.status, jobProgress: job?.progress }
  const statusText = getMotionEffectStatusText(statusInput)
  const progressValue = getMotionEffectProgress(statusInput)

  const busy = ['creating', 'uploading', 'enqueueing', 'queued'].includes(phase) || job?.status === 'processing'
  const paymentLocked = isMotionJobPaymentLocked(job)
  const alreadyPaid = job?.paymentStatus === 'paid'
  const generateLabel = alreadyPaid ? '开始生成' : '免费生成'

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>AI 视频特效</Text>
          <Text style={styles.heroTitle}>手指光膜</Text>
          <Text style={styles.heroSubtitle}>识别双手同名指尖，在它们之间生成随动作变化的动态光膜，并保留原视频声音。</Text>
        </View>
        <View style={styles.heroIcon}><IconFont name="icon-video" color={colors.brand} size={30} /></View>
      </View>

      {restoredJob ? (
        <View style={styles.restoreBanner}>
          <IconFont name="icon-time" color="#087A63" size={18} />
          <View style={styles.restoreMain}>
            <Text style={styles.restoreTitle}>已恢复上次任务</Text>
            <Text style={styles.restoreText}>无需重新上传，生成进度和可下载结果已继续接上。</Text>
          </View>
        </View>
      ) : null}

      <SectionCard title="拍摄建议" description="清晰的视频能显著提高指尖追踪稳定性。">
        <View style={styles.tipList}>
          <TipRow index="1" text="双手完整入镜，手指尽量张开，避免互相遮挡。" />
          <TipRow index="2" text="光线均匀、背景简洁，镜头尽量保持稳定。" />
          <TipRow index="3" text={`视频不超过 ${limits.maxDurationSeconds} 秒、${limits.maxVideoSizeMb}MB。`} />
        </View>
      </SectionCard>

      <SectionCard title="选择光膜风格">
        <View style={styles.styleGrid}>
          {MOTION_STYLE_OPTIONS.map((item) => {
            const active = styleKey === item.key
            return (
              <Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={`${item.name}，${item.description}`} accessibilityState={{ checked: active, disabled: optionsLocked }} disabled={optionsLocked} onPress={() => setStyleKey(item.key)} style={[styles.styleCard, active && styles.optionActive, optionsLocked && styles.disabled]}>
                <View style={styles.swatches}>{item.colors.map((color) => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
                <Text style={styles.optionTitle}>{item.name}</Text>
                <Text style={styles.optionDesc}>{item.description}</Text>
              </Pressable>
            )
          })}
        </View>
      </SectionCard>

      <SectionCard title="选择清晰度" description="全部免费，两种清晰度都可以选。">
        <QualityOption title="标准版 · 720p" desc="适合朋友圈和快速分享" active={exportQuality === 'standard'} disabled={optionsLocked} onPress={() => setExportQuality('standard')} />
        <QualityOption title="高清版 · 1080p" desc="更清晰，适合发布短视频" active={exportQuality === 'hd'} disabled={optionsLocked} onPress={() => setExportQuality('hd')} />
      </SectionCard>

      <SectionCard title="调整效果细节" description="默认「标准 / 均衡 / 均衡」最稳妥，也可以按画面气质微调。">
        <DetailGroup title="动态节奏" options={MOTION_SPEED_OPTIONS} value={motionSpeed} disabled={optionsLocked} onChange={setMotionSpeed} />
        <DetailGroup title="边缘光强度" options={GLOW_STRENGTH_OPTIONS} value={glowStrength} disabled={optionsLocked} onChange={setGlowStrength} />
        <DetailGroup title="膜面浓度" options={SURFACE_DENSITY_OPTIONS} value={surfaceDensity} disabled={optionsLocked} onChange={setSurfaceDensity} />
        {optionsLocked ? <Text style={styles.optionDesc}>当前视频已锁定以上设置；制作新视频后可重新选择。</Text> : null}
      </SectionCard>

      <SectionCard title="上传视频" description={`每日最多生成 ${limits.dailyLimit} 次；原视频和结果默认仅保留 24 小时。`}>
        <Pressable disabled={busy} onPress={() => void chooseVideo()} style={[styles.uploadBox, busy && styles.disabled]}>
          {phase === 'creating' || phase === 'uploading' ? <ActivityIndicator color={colors.brand} /> : <IconFont name="icon-video" color={colors.brand} size={28} />}
          <Text style={styles.uploadTitle}>{video?.name || '从相册选择视频'}</Text>
          <Text style={styles.uploadMeta}>{video ? `${formatFileSize(video.size)} · ${formatDuration(video.durationSeconds)}` : '支持 MP4、MOV 等常见视频格式'}</Text>
        </Pressable>

        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressTitle}>{statusText}</Text>
            <Text style={styles.progressValue}>{progressValue}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressValue}%` }]} /></View>
          {job?.status === 'queued' && job.queueInfo ? (
            <Text style={styles.queueText}>{job.queueInfo.jobsAhead > 0 ? `前方还有 ${job.queueInfo.jobsAhead} 个任务` : '即将开始处理'}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={generateLabel} accessibilityState={{ disabled: phase !== 'uploaded' || paying, busy: paying }} disabled={phase !== 'uploaded' || paying} onPress={() => void startGeneration()} style={[styles.primaryButton, (phase !== 'uploaded' || paying) && styles.buttonDisabled]}>
            <Text style={styles.primaryButtonText}>{paying ? '正在处理…' : phase === 'enqueueing' ? '提交中…' : generateLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="重新选择" accessibilityState={{ disabled: busy || paying || paymentLocked }} disabled={busy || paying || paymentLocked} onPress={reset} style={[styles.secondaryButton, (busy || paying || paymentLocked) && styles.buttonDisabled]}>
            <Text style={styles.secondaryButtonText}>重新选择</Text>
          </Pressable>
        </View>

        {checkout && phase === 'uploaded' ? (
          <View style={styles.checkoutCard}>
            <Text style={styles.optionTitle}>有一笔付款待确认 {formatMotionPrice(checkout.order.totalAmountCents)}</Text>
            <Text style={styles.optionDesc}>这笔订单是改为免费之前发起的，还没付的话不用再付，最多 1 小时后可以重新选择视频。</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="刷新支付状态" disabled={paying} onPress={() => void checkPayment(checkout.job.id)} style={[styles.primaryButton, paying && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{paying ? '正在查询…' : '刷新支付状态'}</Text></Pressable>
            </View>
          </View>
        ) : null}
        {!pollTimerRef.current && (job?.status === 'queued' || job?.status === 'processing') ? (
          <Pressable onPress={() => pollJob(job.id)} style={styles.retryButton}><Text style={styles.retryText}>继续刷新</Text></Pressable>
        ) : null}
        {job?.status === 'failed' ? (
          alreadyPaid
            ? <Pressable accessibilityRole="button" accessibilityLabel="免费重新生成" onPress={() => void enqueueJob(job.id)} style={styles.retryButton}><Text style={styles.retryText}>免费重新生成（这次已付款）</Text></Pressable>
            : <Pressable onPress={() => video ? void prepareUpload(video) : reset()} style={styles.retryButton}><Text style={styles.retryText}>重新生成</Text></Pressable>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {job?.errorMessage ? <Text style={styles.errorText}>{job.errorMessage}</Text> : null}
        {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
      </SectionCard>

      {job?.status === 'done' ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderMain}>
              <Text style={styles.resultKicker}>生成完成</Text>
              <Text style={styles.resultTitle}>你的光膜视频</Text>
            </View>
            <Pressable disabled={saving || !job.canDownload} onPress={() => void saveResult()} style={[styles.downloadButton, (saving || !job.canDownload) && styles.buttonDisabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.downloadText}>保存相册</Text>}
            </Pressable>
          </View>
          {previewUrl ? <NativeVideoPlayer url={previewUrl} title="手指光膜生成结果" /> : <Text style={styles.hintText}>正在获取安全预览地址…</Text>}
          {job.result ? (
            <View style={styles.metricGrid}>
              <MetricCard label="分析帧数" value={`${job.result.analyzedFrames}`} />
              <MetricCard label="识别到手" value={`${job.result.handFrames} 帧`} />
              <MetricCard label="光膜峰值" value={`${job.result.peakPairs} 组`} brand />
              <MetricCard label="视频时长" value={formatDuration(job.result.durationSeconds)} />
            </View>
          ) : null}
          <View style={styles.audioStatus}>
            <IconFont name="icon-video" color={job.result?.audioPreserved ? '#087A63' : colors.textMuted} size={16} />
            <Text style={styles.audioText}>{job.result?.audioPreserved ? '结果视频已保留原音频' : '结果视频未检测到可保留的音频'}</Text>
          </View>
        </View>
      ) : null}
    </Page>
  )
}

function TipRow({ index, text }: { index: string; text: string }) {
  return <View style={styles.tipRow}><View style={styles.tipIndex}><Text style={styles.tipIndexText}>{index}</Text></View><Text style={styles.tipText}>{text}</Text></View>
}

function MetricCard({ label, value, brand }: { label: string; value: string; brand?: boolean }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, brand && styles.metricValueBrand]}>{value}</Text></View>
}

function QualityOption({ title, desc, active, disabled, onPress }: { title: string; desc: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.priceOption, active && styles.optionActive, disabled && styles.disabled]}>
      <View style={styles.priceMain}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
    </Pressable>
  )
}

function DetailGroup<T extends string>({ title, options, value, disabled, onChange }: { title: string; options: Array<{ value: T; label: string; description: string }>; value: T; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <View style={styles.detailGroup}>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.detailRow}>
        {options.map((option) => (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`${title}：${option.label}，${option.description}`} accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)} style={[styles.detailOption, value === option.value && styles.optionActive, disabled && styles.disabled]}>
            <Text style={styles.optionTitle}>{option.label}</Text>
            <Text style={styles.optionDesc}>{option.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  styleCard: { width: '48%', flexGrow: 1, gap: 4, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  swatches: { flexDirection: 'row', gap: 4 },
  swatch: { width: 20, height: 20, borderRadius: radius.pill },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  optionDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  priceOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  priceMain: { flex: 1, gap: 2 },
  detailGroup: { gap: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.xs },
  detailOption: { flex: 1, gap: 2, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  checkoutCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft },
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
  tipList: { gap: spacing.sm },
  tipRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipIndex: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  tipIndexText: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  tipText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  uploadBox: { minHeight: 144, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  uploadTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  uploadMeta: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  progressCard: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  progressValue: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.border },
  progressFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  queueText: { marginTop: spacing.xs, color: colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  retryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.brand, marginTop: spacing.sm },
  retryText: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  resultCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  resultHeaderMain: { flex: 1 },
  resultKicker: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  resultTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  downloadButton: { minHeight: 48, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#1F1F1F' },
  downloadText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '47%', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  metricLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  metricValueBrand: { color: colors.brand },
  audioStatus: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  audioText: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  errorText: { marginTop: spacing.xs, color: colors.danger, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  hintText: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.58 },
  buttonDisabled: { opacity: 0.5 },
})
