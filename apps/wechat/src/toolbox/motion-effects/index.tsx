import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Canvas, Text, View, Video } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { API_BASE_URL, request } from '@/utils/request'
import { authService } from '@/services/authService'
import {
  requestWechatPayment,
  type WechatPaymentParams
} from '@/services/paymentService'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import {
  drawLivePreview,
  smoothLiveHands,
  type LiveHand
} from './livePreview'
import './index.scss'

type JobStatus =
  | 'awaiting_upload'
  | 'awaiting_payment'
  | 'queued'
  | 'processing'
  | 'done'
  | 'failed'
  | 'expired'
type Phase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'
type MotionSpeed = 'gentle' | 'balanced' | 'energetic'
type GlowStrength = 'soft' | 'balanced' | 'strong'
type SurfaceDensity = 'transparent' | 'balanced' | 'rich'
type PreviewState = 'idle' | 'downloading' | 'ready' | 'error'
type CaptureMode = 'live' | 'upload'
type CameraDevice = 'front' | 'back'
type LiveStatus = 'idle' | 'starting' | 'ready' | 'unsupported' | 'error'

interface StyleOption {
  key: string
  name: string
  description: string
  colors: string[]
}

interface DetailOption<T extends string> {
  value: T
  label: string
  description: string
}
type ExportQuality = 'standard' | 'hd'
type QueueTier = 'standard' | 'priority'

interface SelectedVideo {
  tempFilePath: string
  name: string
  contentType: string
  size: number
  duration: number
}

interface MotionJob {
  id: string
  status: JobStatus
  progress: number
  errorMessage: string | null
  canDownload: boolean
  exportQuality: ExportQuality
  queueTier: QueueTier
  styleKey: string
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'free' | 'refunded'
  priceCents: number
  result?: {
    analyzedFrames: number
    handFrames: number
    peakPairs: number
    durationSeconds: number
    audioPreserved: boolean
  } | null
  queueInfo?: {
    jobsAhead: number
    processingAhead: number
    queuedAhead: number
    totalQueued: number
  } | null
}

interface CreateResponse {
  job: MotionJob
  limits: {
    maxVideoSizeMb: number
    maxDurationSeconds: number
    dailyLimit: number
  }
  signupFreeAvailable: boolean
  prices: {
    standardCents: number
    hdCents: number
    priorityAddonCents: number
  }
}

interface DownloadResponse {
  url: string
  proxyUrl?: string
  signedUrl?: string
  filename: string
}

interface StatusPresentation {
  stage: string
  title: string
  detail: string
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    key: 'aurora',
    name: '极光流体',
    description: '青绿、蓝紫与粉色缓慢流动',
    colors: ['#35d7c0', '#5278f6', '#e762ce']
  },
  {
    key: 'cyber',
    name: '赛博霓虹',
    description: '电蓝、紫罗兰和高亮品红',
    colors: ['#26bfff', '#7547ff', '#ff32bd']
  },
  {
    key: 'lava',
    name: '熔岩脉冲',
    description: '金黄、橙红与深红热浪',
    colors: ['#ffcf45', '#ff6b2e', '#c91f37']
  },
  {
    key: 'candy',
    name: '糖果派对',
    description: '蜜桃粉、柠檬黄与薄荷青',
    colors: ['#ff87b8', '#ffe35b', '#65dec5']
  },
  {
    key: 'ice',
    name: '冰晶折射',
    description: '银白、浅蓝与冰紫色折射',
    colors: ['#eaf9ff', '#74d4ff', '#a69cff']
  },
  {
    key: 'galaxy',
    name: '星云跃迁',
    description: '深蓝、星紫与玫红交替闪烁',
    colors: ['#315acb', '#854bc8', '#ed4f9d']
  },
  {
    key: 'emerald',
    name: '翡翠能量',
    description: '祖母绿、湖蓝与荧光黄绿',
    colors: ['#22a56c', '#30bdb8', '#b1e541']
  },
  {
    key: 'gold',
    name: '鎏金光幕',
    description: '香槟金、琥珀与暖白光带',
    colors: ['#fff0b3', '#d99c35', '#fff8e5']
  }
]

const MOTION_SPEED_OPTIONS: DetailOption<MotionSpeed>[] = [
  { value: 'gentle', label: '舒缓', description: '颜色和扫光移动更慢' },
  { value: 'balanced', label: '标准', description: '节奏自然，适合大多数视频' },
  { value: 'energetic', label: '动感', description: '颜色和扫光变化更快' }
]

const GLOW_STRENGTH_OPTIONS: DetailOption<GlowStrength>[] = [
  { value: 'soft', label: '柔光', description: '边缘更克制' },
  { value: 'balanced', label: '均衡', description: '清晰但不过曝' },
  { value: 'strong', label: '高亮', description: '边缘光更醒目' }
]

const SURFACE_DENSITY_OPTIONS: DetailOption<SurfaceDensity>[] = [
  { value: 'transparent', label: '通透', description: '保留更多原画面' },
  { value: 'balanced', label: '均衡', description: '光膜与画面平衡' },
  { value: 'rich', label: '浓郁', description: '膜面颜色更饱满' }
]

interface CheckoutResponse {
  job: MotionJob
  order: {
    id: string
    totalAmountCents: number
    totalAmountYuan: number
    status: string
  }
  paymentInfo: {
    provider?: 'wechat' | 'alipay'
    paymentParams?: WechatPaymentParams
    description: string
  }
}

interface WechatPaymentQueryResponse {
  status: 'pending' | 'success' | 'failed' | 'cancelled'
}

interface QuoteResponse {
  signedIn: boolean
  signupFreeAvailable: boolean
  prices: {
    standardCents: number
    hdCents: number
    priorityAddonCents: number
  }
  resourceNotice: string
}

const MAX_SIZE_MB = 100
const MAX_DURATION_SECONDS = 30
const TERMINAL: JobStatus[] = ['done', 'failed', 'expired']
const TRANSFER_TIMEOUT = 15 * 60 * 1000
const LIVE_CANVAS_ID = 'motionLiveCanvas'
const LIVE_DETECT_INTERVAL_MS = 80
const LIVE_RECORDING_SECONDS = 30

const LIVE_STYLE_STRENGTH = {
  glow: {
    soft: 0.52,
    balanced: 0.72,
    strong: 0.92
  } satisfies Record<GlowStrength, number>,
  surface: {
    transparent: 0.14,
    balanced: 0.24,
    rich: 0.36
  } satisfies Record<SurfaceDensity, number>
}

async function callApi<T>(options: {
  url: string
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
}) {
  const response = await request<T>({
    url: options.url,
    method: options.method || 'GET',
    data: options.data,
    showErrorToast: false
  })
  if (!response.success || !response.data) {
    throw new Error(response.message || '请求失败')
  }
  return response.data
}

function inferName(path: string) {
  const tail = String(path || '').split('?')[0].split('/').pop() || ''
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(tail)
    ? tail
    : `jiaolian-finger-${Date.now()}.mp4`
}

function inferType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv') return 'video/x-matroska'
  if (ext === 'avi') return 'video/x-msvideo'
  return 'video/mp4'
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getLocalFileSize(filePath: string) {
  const fileSystem = (Taro as any).getFileSystemManager()
  return new Promise<number>((resolve, reject) => {
    fileSystem.getFileInfo({
      filePath,
      success: (result: any) => resolve(Number(result?.size || 0)),
      fail: (error: any) => reject(new Error(error?.errMsg || '无法读取录像大小'))
    })
  })
}

async function createRecordedVideo(tempFilePath: string): Promise<SelectedVideo> {
  const [info, size] = await Promise.all([
    Taro.getVideoInfo({ src: tempFilePath }),
    getLocalFileSize(tempFilePath)
  ])
  const name = `jiaolian-finger-live-${Date.now()}.mp4`
  return {
    tempFilePath,
    name,
    contentType: 'video/mp4',
    size,
    duration: Number(info?.duration || 0)
  }
}

function copyVideoToNamedLocalFile(tempFilePath: string, jobId: string) {
  const taroRuntime = Taro as any
  const userDataPath = String(taroRuntime.env?.USER_DATA_PATH || '').replace(/\/$/, '')
  if (!userDataPath) {
    throw new Error('当前环境无法创建本地 MP4 文件')
  }
  const filename = `jiaolian-finger-vfx-${jobId.slice(0, 8)}.mp4`
  const localPath = `${userDataPath}/${filename}`
  const fileSystem = taroRuntime.getFileSystemManager()
  return new Promise<{ localPath: string; filename: string }>((resolve, reject) => {
    const copy = () => {
      fileSystem.copyFile({
        srcPath: tempFilePath,
        destPath: localPath,
        success: () => resolve({ localPath, filename }),
        fail: (error: any) => reject(new Error(error?.errMsg || '本地 MP4 文件创建失败'))
      })
    }
    fileSystem.unlink({
      filePath: localPath,
      success: copy,
      fail: copy
    })
  })
}

function getProcessingPresentation(progress: number): StatusPresentation {
  if (progress <= 10) {
    return {
      stage: '准备渲染',
      title: `正在准备素材 ${progress}%`,
      detail: '正在下载原视频并加载手指识别模型。文件较大时可能需要几分钟，这不是卡住。'
    }
  }
  if (progress < 92) {
    return {
      stage: '识别绘制',
      title: `正在生成光膜 ${progress}%`,
      detail: '正在逐帧识别同名手指，并绘制动态光膜效果。'
    }
  }
  if (progress < 95) {
    return {
      stage: '合成视频',
      title: `正在合成成片 ${progress}%`,
      detail: '画面已经处理完成，正在合并原音频并编码通用 MP4。'
    }
  }
  return {
    stage: '上传成片',
    title: `正在保存成片 ${progress}%`,
    detail: '正在把最终视频上传到临时存储，完成后即可预览和保存。'
  }
}

function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(1)}`
}

function uploadVideo(params: {
  jobId: string
  filePath: string
  onProgress: (value: number) => void
}) {
  return new Promise<void>((resolve, reject) => {
    const token = String(Taro.getStorageSync('token') || '').trim()
    if (!token) {
      reject(new Error('请先登录后再生成特效视频'))
      return
    }
    const task = Taro.uploadFile({
      url: `${API_BASE_URL}/api/toolbox/motion-effects/jobs/${params.jobId}/upload`,
      filePath: params.filePath,
      name: 'file',
      timeout: TRANSFER_TIMEOUT,
      header: { Authorization: `Bearer ${token}` },
      success: (result: any) => {
        let payload: any = result.data
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = null
          }
        }
        if (result.statusCode >= 200 && result.statusCode < 300 && payload?.success) {
          params.onProgress(100)
          resolve()
        } else {
          reject(new Error(payload?.message || `上传失败（${result.statusCode}）`))
        }
      },
      fail: (error: any) => reject(new Error(error?.errMsg || '上传失败'))
    }) as any
    task?.progress?.((result: any) => {
      params.onProgress(Math.max(1, Math.min(99, Number(result.progress || 0))))
    })
  })
}

export default function FingerMotionEffectsPage() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cameraContextRef = useRef<any>(null)
  const frameListenerRef = useRef<any>(null)
  const visionSessionRef = useRef<any>(null)
  const detectionBusyRef = useRef(false)
  const lastDetectAtRef = useRef(0)
  const latestFrameSizeRef = useRef({ width: 0, height: 0 })
  const canvasSizeRef = useRef({ width: 0, height: 0 })
  const smoothedHandsRef = useRef<LiveHand[]>([])
  const liveMetricsRef = useRef({ handCount: 0, pairCount: 0 })
  const liveDrawSettingsRef = useRef({
    colors: STYLE_OPTIONS[0].colors,
    glowAlpha: LIVE_STYLE_STRENGTH.glow.balanced,
    surfaceAlpha: LIVE_STYLE_STRENGTH.surface.balanced
  })
  const recordingRef = useRef(false)
  const processedRecordingPathRef = useRef('')
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [job, setJob] = useState<MotionJob | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFilename, setPreviewFilename] = useState('')
  const [previewState, setPreviewState] = useState<PreviewState>('idle')
  const [saving, setSaving] = useState(false)
  const [selectedStyleKey, setSelectedStyleKey] = useState('aurora')
  const [motionSpeed, setMotionSpeed] = useState<MotionSpeed>('balanced')
  const [glowStrength, setGlowStrength] = useState<GlowStrength>('balanced')
  const [surfaceDensity, setSurfaceDensity] = useState<SurfaceDensity>('balanced')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('live')
  const [cameraDevice, setCameraDevice] = useState<CameraDevice>('front')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle')
  const [liveStatusDetail, setLiveStatusDetail] = useState('正在等待相机启动')
  const [liveHandCount, setLiveHandCount] = useState(0)
  const [livePairCount, setLivePairCount] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const selectedStyle = useMemo(
    () => STYLE_OPTIONS.find((style) => style.key === selectedStyleKey) || STYLE_OPTIONS[0],
    [selectedStyleKey]
  )
  const [exportQuality, setExportQuality] = useState<ExportQuality>('standard')
  const [queueTier, setQueueTier] = useState<QueueTier>('standard')
  const [signupFreeAvailable, setSignupFreeAvailable] = useState(false)
  const [prices, setPrices] = useState({
    standardCents: 290,
    hdCents: 490,
    priorityAddonCents: 190
  })
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null)
  const [paying, setPaying] = useState(false)

  const optionsLocked = recording || phase !== 'idle' || Boolean(job)
  const freeStandardSelected = signupFreeAvailable && exportQuality === 'standard'
  const selectedPriceCents =
    (freeStandardSelected
      ? 0
      : exportQuality === 'hd'
        ? prices.hdCents
        : prices.standardCents) +
    (queueTier === 'priority' ? prices.priorityAddonCents : 0)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '教链手指光膜',
        path: buildSharePath('/toolbox/motion-effects/index')
      }),
    []
  )
  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    liveDrawSettingsRef.current = {
      colors: selectedStyle.colors,
      glowAlpha: LIVE_STYLE_STRENGTH.glow[glowStrength],
      surfaceAlpha: LIVE_STYLE_STRENGTH.surface[surfaceDensity]
    }
    const canvas = canvasSizeRef.current
    const frame = latestFrameSizeRef.current
    if (canvas.width && frame.width && smoothedHandsRef.current.length) {
      drawLivePreview({
        canvas,
        canvasId: LIVE_CANVAS_ID,
        frame,
        hands: smoothedHandsRef.current,
        // CameraFrame 的点位已经与前置相机预览同向，不能再次水平镜像。
        mirrored: false,
        style: liveDrawSettingsRef.current
      })
    }
  }, [cameraDevice, glowStrength, selectedStyle, surfaceDensity])

  useEffect(() => {
    openCoachLinkShareMenu()
    void callApi<QuoteResponse>({
      url: '/api/toolbox/motion-effects/quote'
    }).then((quote) => {
      setSignupFreeAvailable(quote.signupFreeAvailable)
      setPrices(quote.prices)
    }).catch(() => {
      // 保留页面内置价格；真正创建订单时仍以后端报价为准。
    })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (captureMode !== 'live' || !cameraReady) return

    let stopped = false
    let releaseDetectionTimer: ReturnType<typeof setTimeout> | null = null
    const taroRuntime = Taro as any
    const updateLiveMetrics = (handCount: number, pairCount: number) => {
      const current = liveMetricsRef.current
      if (current.handCount !== handCount) setLiveHandCount(handCount)
      if (current.pairCount !== pairCount) setLivePairCount(pairCount)
      liveMetricsRef.current = { handCount, pairCount }
    }
    const setUnavailable = (message: string, unsupported = false) => {
      if (stopped) return
      setLiveStatus(unsupported ? 'unsupported' : 'error')
      setLiveStatusDetail(message)
      detectionBusyRef.current = false
    }

    Taro.nextTick(() => {
      Taro.createSelectorQuery()
        .select('#motion-live-canvas')
        .boundingClientRect((rect: any) => {
          if (!rect || stopped) return
          canvasSizeRef.current = {
            width: Number(rect.width || 0),
            height: Number(rect.height || 0)
          }
        })
        .exec()
    })

    setLiveStatus('starting')
    setLiveStatusDetail('正在启动微信端侧手部识别')
    cameraContextRef.current = Taro.createCameraContext()
    try {
      if (typeof taroRuntime.createVKSession !== 'function') {
        setUnavailable('当前微信版本不支持实时识别，仍可录制并生成高清成片。', true)
        return
      }

      const session = taroRuntime.createVKSession({
        track: { hand: { mode: 2 } }
      })
      visionSessionRef.current = session

      const renderTrackedHands = () => {
        const canvas = canvasSizeRef.current
        const frame = latestFrameSizeRef.current
        if (!canvas.width || !frame.width) return
        const metrics = drawLivePreview({
          canvas,
          canvasId: LIVE_CANVAS_ID,
          frame,
          hands: smoothedHandsRef.current,
          mirrored: false,
          style: liveDrawSettingsRef.current
        })
        updateLiveMetrics(metrics.handCount, metrics.pairCount)
      }

      const handleAnchors = (anchors: any[]) => {
        if (stopped) return
        detectionBusyRef.current = false
        if (releaseDetectionTimer) clearTimeout(releaseDetectionTimer)
        const hands = (Array.isArray(anchors) ? anchors : [])
          .filter((anchor) => Array.isArray(anchor?.points) && anchor.points.length >= 21)
          .slice(0, 2)
          .map((anchor) => ({
            confidence: anchor.confidence,
            points: anchor.points.map((point: any) => ({
              x: Number(point?.x || 0),
              y: Number(point?.y || 0)
            })),
            score: Number(anchor.score ?? 1)
          })) satisfies LiveHand[]

        smoothedHandsRef.current = smoothLiveHands(smoothedHandsRef.current, hands)
        renderTrackedHands()
      }

      const handleRemovedAnchors = () => {
        if (stopped) return
        detectionBusyRef.current = false
        smoothedHandsRef.current = smoothLiveHands(smoothedHandsRef.current, [])
        renderTrackedHands()
      }

      session.on('updateAnchors', handleAnchors)
      session.on('removeAnchors', handleRemovedAnchors)
      session.start((status: number | null) => {
        if (stopped) return
        if (status && Number(status) !== 0) {
          setUnavailable(
            Number(status) === 2000002 || Number(status) === 2000003
              ? '当前设备不支持实时识别，仍可录制并生成高清成片。'
              : `实时识别启动失败（${status}），仍可正常录制。`,
            Number(status) === 2000002 || Number(status) === 2000003
          )
          return
        }

        setLiveStatus('ready')
        setLiveStatusDetail('识别在本机完成；实时画面只作预览，成片仍由服务器高清渲染。')
        const context = cameraContextRef.current
        try {
          const listener = context.onCameraFrame((frame: any) => {
            if (stopped) return
            const now = Date.now()
            if (detectionBusyRef.current || now - lastDetectAtRef.current < LIVE_DETECT_INTERVAL_MS) {
              return
            }
            const width = Number(frame?.width || 0)
            const height = Number(frame?.height || 0)
            if (!width || !height || !(frame?.data instanceof ArrayBuffer)) return
            lastDetectAtRef.current = now
            latestFrameSizeRef.current = { width, height }
            detectionBusyRef.current = true
            try {
              session.detectHand({
                algoMode: 0,
                frameBuffer: frame.data,
                height,
                scoreThreshold: 0.35,
                width
              })
              releaseDetectionTimer = setTimeout(() => {
                detectionBusyRef.current = false
                smoothedHandsRef.current = smoothLiveHands(smoothedHandsRef.current, [])
                renderTrackedHands()
              }, 320)
            } catch (error: any) {
              setUnavailable(error?.message || '实时识别暂时不可用，仍可正常录制。')
            }
          })
          frameListenerRef.current = listener
          listener.start()
        } catch (error: any) {
          setUnavailable(error?.message || '无法读取实时相机帧，仍可正常录制。')
        }
      })
    } catch (error: any) {
      setUnavailable(error?.message || '当前设备不支持实时识别，仍可录制并生成高清成片。', true)
    }

    return () => {
      stopped = true
      if (releaseDetectionTimer) clearTimeout(releaseDetectionTimer)
      try {
        frameListenerRef.current?.stop?.()
      } catch {}
      frameListenerRef.current = null
      try {
        visionSessionRef.current?.stop?.()
        visionSessionRef.current?.destroy?.()
      } catch {}
      visionSessionRef.current = null
      detectionBusyRef.current = false
      smoothedHandsRef.current = []
      liveMetricsRef.current = { handCount: 0, pairCount: 0 }
    }
  }, [cameraDevice, cameraReady, captureMode])

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  const prepareCompletedVideo = async (jobId: string, force = false) => {
    if (!force && previewUrl && previewState === 'ready') {
      return previewUrl
    }
    setPreviewState('downloading')
    let filename = `jiaolian-finger-vfx-${jobId.slice(0, 8)}.mp4`
    try {
      const data = await callApi<DownloadResponse>({
        url: `/api/toolbox/motion-effects/jobs/${jobId}/download-url`,
        method: 'POST'
      })
      filename = data.filename || filename
      const downloaded = await Taro.downloadFile({
        url: data.url,
        timeout: TRANSFER_TIMEOUT
      })
      if (downloaded.statusCode !== 200 || !downloaded.tempFilePath) {
        throw new Error(`下载失败（${downloaded.statusCode}）`)
      }
      const localVideo = await copyVideoToNamedLocalFile(downloaded.tempFilePath, jobId)
      setPreviewUrl(localVideo.localPath)
      setPreviewFilename(localVideo.filename)
      setPreviewState('ready')
      return localVideo.localPath
    } catch (error) {
      setPreviewUrl('')
      setPreviewFilename(filename)
      setPreviewState('error')
      throw error
    }
  }

  const pollJob = (jobId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const current = await callApi<MotionJob>({
          url: `/api/toolbox/motion-effects/jobs/${jobId}`
        })
        setJob(current)
        if (TERMINAL.includes(current.status)) {
          stopPolling()
          setPhase('done')
          if (current.status === 'done') {
            try {
              await prepareCompletedVideo(current.id)
              Taro.showToast({ title: '特效视频已生成', icon: 'success' })
            } catch (error: any) {
              Taro.showToast({
                title: error?.message || '成片已完成，请重试加载',
                icon: 'none',
                duration: 3000
              })
            }
          }
        }
      } catch (error: any) {
        stopPolling()
        setPhase('idle')
        Taro.showToast({
          title: error?.message || '任务状态获取失败',
          icon: 'none',
          duration: 3000
        })
      }
    }, 1800)
  }

  const openLogin = () => {
    Taro.navigateTo({ url: authService.buildLoginUrl('/toolbox/motion-effects/index') })
  }

  const changeOption = (apply: () => void) => {
    if (optionsLocked) {
      Taro.showToast({ title: '当前视频已锁定效果，请先制作新视频', icon: 'none' })
      return
    }
    apply()
  }

  const handleReset = () => {
    stopPolling()
    setVideo(null)
    setJob(null)
    setCheckout(null)
    setPhase('idle')
    setUploadProgress(0)
    setPreviewUrl('')
    setPreviewFilename('')
    setPreviewState('idle')
    setSaving(false)
  }

  const prepareAndUploadVideo = async (nextVideo: SelectedVideo) => {
    if (nextVideo.size <= 0 || nextVideo.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`视频需小于 ${MAX_SIZE_MB}MB`)
    }
    if (nextVideo.duration <= 0 || nextVideo.duration > MAX_DURATION_SECONDS + 0.5) {
      throw new Error(`视频需为 1-${MAX_DURATION_SECONDS} 秒`)
    }

    stopPolling()
    setVideo(nextVideo)
    setPreviewUrl('')
    setPreviewFilename('')
    setPreviewState('idle')
    setJob(null)
    setCheckout(null)
    setUploadProgress(0)
    setPhase('creating')
    const created = await callApi<CreateResponse>({
      url: '/api/toolbox/motion-effects/create-upload-url',
      method: 'POST',
      data: {
        originalFilename: nextVideo.name,
        contentType: nextVideo.contentType,
        fileSizeBytes: nextVideo.size,
        durationSeconds: nextVideo.duration,
        exportQuality,
        queueTier,
        styleKey: selectedStyleKey,
        bgmKey: 'original',
        motionSpeed,
        glowStrength,
        surfaceDensity
      }
    })
    setJob(created.job)
    setSignupFreeAvailable(created.signupFreeAvailable)
    setPrices(created.prices)
    setPhase('uploading')
    await uploadVideo({
      jobId: created.job.id,
      filePath: nextVideo.tempFilePath,
      onProgress: setUploadProgress
    })
    setPhase('uploaded')
    Taro.showToast({ title: '原片已上传', icon: 'success' })
  }

  const handleChooseVideo = async () => {
    if (!authService.isAuthenticated()) {
      Taro.showModal({
        title: '登录后可用',
        content: '登录后可以生成并保存带“教链”标识的特效视频。',
        confirmText: '去登录',
        success: (result) => {
          if (result.confirm) openLogin()
        }
      })
      return
    }
    if (['creating', 'uploading', 'enqueueing', 'queued'].includes(phase)) {
      Taro.showToast({ title: '当前任务处理中', icon: 'none' })
      return
    }
    try {
      const selected = await Taro.chooseVideo({
        sourceType: ['album'],
        maxDuration: MAX_DURATION_SECONDS,
        compressed: true,
        camera: 'back'
      })
      const name = inferName(selected.tempFilePath)
      const nextVideo: SelectedVideo = {
        tempFilePath: selected.tempFilePath,
        name,
        contentType: inferType(name),
        size: Number(selected.size || 0),
        duration: Number(selected.duration || 0)
      }
      await prepareAndUploadVideo(nextVideo)
    } catch (error: any) {
      const message = String(error?.errMsg || error?.message || '')
      if (message.includes('cancel')) return
      setPhase('idle')
      setJob(null)
      Taro.showToast({ title: message || '选择或上传失败', icon: 'none', duration: 3000 })
    }
  }

  const resetRecordingState = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    recordingTimerRef.current = null
    recordingRef.current = false
    setRecording(false)
  }

  const handleRecordedVideo = async (result: any) => {
    const tempVideoPath = String(result?.tempVideoPath || '')
    resetRecordingState()
    if (!tempVideoPath || processedRecordingPathRef.current === tempVideoPath) return
    processedRecordingPathRef.current = tempVideoPath
    try {
      const recordedVideo = await createRecordedVideo(tempVideoPath)
      await prepareAndUploadVideo(recordedVideo)
    } catch (error: any) {
      setPhase('idle')
      setJob(null)
      Taro.showToast({
        title: error?.message || error?.errMsg || '录像上传失败',
        icon: 'none',
        duration: 3000
      })
    }
  }

  const handleStartRecording = () => {
    if (!authService.isAuthenticated()) {
      Taro.showModal({
        title: '登录后可录制',
        content: '登录后可上传原片并生成高清特效视频。实时预览本身不会上传画面。',
        confirmText: '去登录',
        success: (result) => {
          if (result.confirm) openLogin()
        }
      })
      return
    }
    if (!cameraReady || !cameraContextRef.current) {
      Taro.showToast({ title: '相机还没准备好', icon: 'none' })
      return
    }
    if (recordingRef.current || ['creating', 'uploading', 'enqueueing', 'queued'].includes(phase)) {
      return
    }

    if (job) handleReset()

    processedRecordingPathRef.current = ''
    setRecordingSeconds(0)
    try {
      cameraContextRef.current.startRecord({
        timeout: LIVE_RECORDING_SECONDS,
        success: () => {
          recordingRef.current = true
          setRecording(true)
          const startedAt = Date.now()
          recordingTimerRef.current = setInterval(() => {
            setRecordingSeconds(
              Math.min(LIVE_RECORDING_SECONDS, Math.floor((Date.now() - startedAt) / 1000))
            )
          }, 500)
        },
        fail: (error: any) => {
          resetRecordingState()
          Taro.showToast({ title: error?.errMsg || '开始录像失败', icon: 'none' })
        },
        timeoutCallback: (result: any) => {
          void handleRecordedVideo(result)
        }
      })
    } catch (error: any) {
      resetRecordingState()
      Taro.showToast({ title: error?.message || '当前环境无法录像', icon: 'none' })
    }
  }

  const handleStopRecording = () => {
    if (!recordingRef.current || !cameraContextRef.current) return
    cameraContextRef.current.stopRecord({
      compressed: true,
      success: (result: any) => {
        void handleRecordedVideo(result)
      },
      fail: (error: any) => {
        resetRecordingState()
        Taro.showToast({ title: error?.errMsg || '停止录像失败', icon: 'none' })
      }
    })
  }

  const switchCaptureMode = (nextMode: CaptureMode) => {
    if (recordingRef.current || nextMode === captureMode) return
    setCaptureMode(nextMode)
    setCameraReady(false)
    setCameraError('')
    setLiveHandCount(0)
    setLivePairCount(0)
    setLiveStatus('idle')
  }

  const switchCamera = () => {
    if (recordingRef.current) return
    setCameraReady(false)
    setCameraError('')
    setCameraDevice((current) => current === 'front' ? 'back' : 'front')
  }

  const enqueueUploadedJob = async (jobId: string) => {
    setPhase('enqueueing')
    const queued = await callApi<MotionJob>({
      url: `/api/toolbox/motion-effects/jobs/${jobId}/enqueue`,
      method: 'POST'
    })
    setJob(queued)
    setCheckout(null)
    setPhase('queued')
    pollJob(queued.id)
    Taro.showToast({ title: '已开始生成', icon: 'success' })
  }

  const confirmWechatPayment = async (orderId: string, jobId: string) => {
    const payment = await callApi<WechatPaymentQueryResponse>({
      url: '/api/payment/wechat/query',
      method: 'POST',
      data: { orderId }
    })
    if (payment.status !== 'success') return false

    const current = await callApi<MotionJob>({
      url: `/api/toolbox/motion-effects/jobs/${jobId}/payment-status`
    })
    setJob(current)
    if (current.paymentStatus !== 'paid') return false
    await enqueueUploadedJob(current.id)
    return true
  }

  const openWechatPayment = async (created: CheckoutResponse) => {
    const paymentParams = created.paymentInfo?.paymentParams
    if (!paymentParams) throw new Error('微信支付参数缺失，请稍后重试')

    const result = await requestWechatPayment(paymentParams)
    if (result.status === 'cancelled') {
      Taro.showToast({ title: '已取消支付，可以稍后重新支付', icon: 'none' })
      return
    }
    if (!result.success) {
      throw new Error(result.message || '微信支付调起失败')
    }

    const confirmed = await confirmWechatPayment(created.order.id, created.job.id)
    if (!confirmed) {
      Taro.showToast({ title: '支付结果确认中，请稍后刷新', icon: 'none', duration: 3000 })
    }
  }

  const createCheckout = async (jobId: string) => {
    setPaying(true)
    try {
      const created = await callApi<CheckoutResponse>({
        url: `/api/toolbox/motion-effects/jobs/${jobId}/order`,
        method: 'POST',
        data: { paymentProvider: 'wechat' }
      })
      setCheckout(created)
      setJob(created.job)
      await openWechatPayment(created)
    } finally {
      setPaying(false)
    }
  }

  const handleGenerate = async () => {
    if (!job?.id || phase !== 'uploaded' || paying) return
    try {
      if (selectedPriceCents > 0) {
        await createCheckout(job.id)
      } else {
        await enqueueUploadedJob(job.id)
      }
    } catch (error: any) {
      setPhase('uploaded')
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none', duration: 3000 })
    }
  }

  const handleRetryPayment = async () => {
    if (!checkout || paying) return
    setPaying(true)
    try {
      await openWechatPayment(checkout)
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '微信支付调起失败', icon: 'none' })
    } finally {
      setPaying(false)
    }
  }

  const handleCheckPayment = async () => {
    if (!job?.id || paying) return
    setPaying(true)
    try {
      const orderId = checkout?.order.id
      if (!orderId) throw new Error('支付订单不存在，请重新发起支付')
      const confirmed = await confirmWechatPayment(orderId, job.id)
      if (!confirmed) {
        Taro.showToast({ title: '暂未收到支付结果，请稍后再试', icon: 'none' })
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '支付状态查询失败', icon: 'none' })
    } finally {
      setPaying(false)
    }
  }

  const handleSave = async () => {
    if (!job?.id || !job.canDownload) return
    setSaving(true)
    try {
      const localPath =
        previewUrl && previewState === 'ready'
          ? previewUrl
          : await prepareCompletedVideo(job.id, true)
      await Taro.saveVideoToPhotosAlbum({ filePath: localPath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败', icon: 'none', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  const statusPresentation: StatusPresentation = (() => {
    if (phase === 'creating') {
      return {
        stage: '创建任务',
        title: '正在创建临时任务',
        detail: '正在准备安全上传通道。'
      }
    }
    if (phase === 'uploading') {
      return {
        stage: '上传原片',
        title: `正在上传原视频 ${uploadProgress}%`,
        detail: '上传速度取决于当前网络，请保持小程序在前台。'
      }
    }
    if (phase === 'uploaded') {
      return {
        stage: '等待开始',
        title: '视频已上传，可以开始生成',
        detail: '点击下方按钮后，任务会进入独立视频渲染队列。'
      }
    }
    if (phase === 'enqueueing') {
      return {
        stage: '提交任务',
        title: '正在提交渲染任务',
        detail: '正在将视频加入独立处理队列。'
      }
    }
    if (job?.status === 'queued') {
      const ahead = job.queueInfo?.jobsAhead || 0
      return {
        stage: '等待处理',
        title: ahead > 0 ? `排队中，前面还有 ${ahead} 个任务` : '排队中，马上开始',
        detail: '轮到当前任务后会自动下载素材并开始生成。'
      }
    }
    if (job?.status === 'processing') {
      return getProcessingPresentation(Math.max(10, Number(job.progress || 10)))
    }
    if (job?.status === 'done') {
      return {
        stage: '生成完成',
        title: '特效视频已完成',
        detail: '可以预览成片并保存到手机相册。'
      }
    }
    if (job?.status === 'failed') {
      return {
        stage: '生成失败',
        title: job.errorMessage || '生成失败',
        detail: '请重新选择视频后再试一次。'
      }
    }
    if (job?.status === 'expired') {
      return {
        stage: '文件已过期',
        title: '视频已过期，请重新生成',
        detail: '原视频与成片只临时保留 24 小时。'
      }
    }
    return {
      stage: '尚未开始',
      title: '拍摄或选择视频后会自动上传',
      detail: '建议双手完整入镜，并保持背景清晰；实时预览不会替代最终高清渲染。'
    }
  })()

  const progress = job?.status === 'done'
    ? 100
    : job?.status === 'queued' || job?.status === 'processing'
      ? Math.max(5, job.progress || 5)
      : phase === 'uploaded' || phase === 'enqueueing'
        ? 100
        : phase === 'uploading'
          ? uploadProgress
          : phase === 'creating'
            ? 5
            : 0

  return (
    <View className='motion-page'>
      <View className='motion-hero'>
        <Text className='motion-kicker'>教链手指光膜</Text>
        <Text className='motion-title'>伸出几根手指，光膜就由几根手指生长</Text>
        <Text className='motion-description'>
          系统只识别双手真正伸展的同名手指。弯曲或被遮挡的手指不会被硬塞进图形。
        </Text>
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>1. 选择视觉风格</Text>
        <Text className='motion-hint'>8 种风格会改变配色、流动速度、光膜透明度和边缘光感。</Text>
        <View className='motion-style-grid'>
          {STYLE_OPTIONS.map((style) => {
            const selected = selectedStyleKey === style.key
            return (
              <View
                key={style.key}
                className={`motion-style-card ${selected ? 'motion-style-card-selected' : ''}`}
                onClick={() => changeOption(() => setSelectedStyleKey(style.key))}
              >
                <View className='motion-style-heading'>
                  <View className='motion-style-swatches'>
                    {style.colors.map((color) => (
                      <View
                        key={color}
                        className='motion-style-swatch'
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </View>
                  <Text className='motion-style-check'>{selected ? '已选' : ''}</Text>
                </View>
                <Text className='motion-style-name'>{style.name}</Text>
                <Text className='motion-style-description'>{style.description}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>选择下载规格</Text>
        <Text className='motion-hint'>
          预览免费。视频导出会持续占用服务器计算、临时存储和下载带宽，免费资源无法长期支撑，因此下载按规格收费。
        </Text>
        <View
          className={`motion-quality-option ${exportQuality === 'standard' ? 'motion-option-active' : ''}`}
          onClick={() => changeOption(() => setExportQuality('standard'))}
        >
          <View>
            <Text className='motion-option-title'>标准版 · 720p</Text>
            <Text className='motion-option-desc'>
              {signupFreeAvailable ? '注册账号首次标准导出免费' : '适合朋友圈和快速分享'}
            </Text>
          </View>
          <Text className='motion-option-price'>
            {signupFreeAvailable ? '首次免费' : formatPrice(prices.standardCents)}
          </Text>
        </View>
        <View
          className={`motion-quality-option ${exportQuality === 'hd' ? 'motion-option-active' : ''}`}
          onClick={() => changeOption(() => setExportQuality('hd'))}
        >
          <View>
            <Text className='motion-option-title'>高清版 · 1080p</Text>
            <Text className='motion-option-desc'>更清晰，适合发布短视频</Text>
          </View>
          <Text className='motion-option-price'>{formatPrice(prices.hdCents)}</Text>
        </View>
        <View
          className={`motion-quality-option ${queueTier === 'priority' ? 'motion-option-priority' : ''}`}
          onClick={() =>
            changeOption(() =>
              setQueueTier((current) => current === 'priority' ? 'standard' : 'priority')
            )
          }
        >
          <View>
            <Text className='motion-option-title'>极速处理</Text>
            <Text className='motion-option-desc'>进入独立优先队列，按真实任务顺序处理</Text>
          </View>
          <Text className='motion-option-price'>+{formatPrice(prices.priorityAddonCents)}</Text>
        </View>
        <View className='motion-price-total'>
          <Text>本次预计</Text>
          <Text className='motion-price-total-value'>
            {selectedPriceCents === 0 ? '免费' : formatPrice(selectedPriceCents)}
          </Text>
        </View>
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>2. 调整效果细节</Text>
        <Text className='motion-hint'>默认“标准 / 均衡 / 均衡”最稳妥，也可以按画面气质微调。</Text>

        <View className='motion-detail-group'>
          <Text className='motion-detail-title'>动态节奏</Text>
          <View className='motion-option-row'>
            {MOTION_SPEED_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`motion-option ${motionSpeed === option.value ? 'motion-option-selected' : ''}`}
                onClick={() => changeOption(() => setMotionSpeed(option.value))}
              >
                <Text className='motion-option-label'>{option.label}</Text>
                <Text className='motion-option-description'>{option.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='motion-detail-group'>
          <Text className='motion-detail-title'>边缘光强度</Text>
          <View className='motion-option-row'>
            {GLOW_STRENGTH_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`motion-option ${glowStrength === option.value ? 'motion-option-selected' : ''}`}
                onClick={() => changeOption(() => setGlowStrength(option.value))}
              >
                <Text className='motion-option-label'>{option.label}</Text>
                <Text className='motion-option-description'>{option.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='motion-detail-group'>
          <Text className='motion-detail-title'>膜面浓度</Text>
          <View className='motion-option-row'>
            {SURFACE_DENSITY_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`motion-option ${surfaceDensity === option.value ? 'motion-option-selected' : ''}`}
                onClick={() => changeOption(() => setSurfaceDensity(option.value))}
              >
                <Text className='motion-option-label'>{option.label}</Text>
                <Text className='motion-option-description'>{option.description}</Text>
              </View>
            ))}
          </View>
        </View>
        {optionsLocked && (
          <Text className='motion-lock-hint'>当前视频已锁定以上设置；制作新视频后可重新选择。</Text>
        )}
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>3. 实时拍摄或上传原片</Text>
        <Text className='motion-hint'>建议双手完整入镜，单次录制不超过 30 秒；实时光膜只作构图预览。</Text>
        <View className='motion-mode-tabs'>
          <View
            className={`motion-mode-tab ${captureMode === 'live' ? 'motion-mode-tab-selected' : ''}`}
            onClick={() => switchCaptureMode('live')}
          >
            <Text>实时拍摄</Text>
          </View>
          <View
            className={`motion-mode-tab ${captureMode === 'upload' ? 'motion-mode-tab-selected' : ''}`}
            onClick={() => switchCaptureMode('upload')}
          >
            <Text>相册上传</Text>
          </View>
        </View>

        {captureMode === 'live' && (
          <>
            <View className='motion-live-stage'>
              <Camera
                className='motion-live-camera'
                devicePosition={cameraDevice}
                flash='off'
                frameSize='medium'
                resolution='medium'
                onInitDone={() => {
                  setCameraReady(true)
                  setCameraError('')
                }}
                onError={(event: any) => {
                  const message = event?.detail?.errMsg || '相机启动失败，请检查权限'
                  setCameraReady(false)
                  setCameraError(message)
                  setLiveStatus('error')
                  setLiveStatusDetail(message)
                }}
              />
              <Canvas
                id='motion-live-canvas'
                canvasId={LIVE_CANVAS_ID}
                className='motion-live-canvas'
              />
              <View className='motion-live-hud'>
                <Text className='motion-live-badge'>
                  {recording ? `录制 ${recordingSeconds}s / ${LIVE_RECORDING_SECONDS}s` : '实时预览'}
                </Text>
                <Text className='motion-live-counter'>
                  {liveHandCount} 只手 · {livePairCount} 对同名手指
                </Text>
              </View>
              {!cameraReady && !cameraError && (
                <View className='motion-live-placeholder'>
                  <Text>正在启动相机…</Text>
                </View>
              )}
              {cameraError && (
                <View className='motion-live-placeholder motion-live-placeholder-error'>
                  <Text>{cameraError}</Text>
                </View>
              )}
            </View>

            <View className={`motion-live-status motion-live-status-${liveStatus}`}>
              <Text className='motion-live-status-title'>
                {liveStatus === 'ready'
                  ? liveHandCount >= 2
                    ? '双手已识别，开始舞动吧'
                    : '请让双手完整进入画面'
                  : liveStatus === 'starting'
                    ? '正在准备实时识别'
                    : liveStatus === 'unsupported'
                      ? '当前设备使用兼容拍摄模式'
                      : liveStatus === 'error'
                        ? '实时预览暂不可用'
                        : '等待相机'}
              </Text>
              <Text className='motion-live-status-detail'>{liveStatusDetail}</Text>
            </View>

            <View className='motion-live-actions'>
              <View
                className={`motion-live-switch ${recording ? 'motion-button-disabled' : ''}`}
                onClick={switchCamera}
              >
                <Text>{cameraDevice === 'front' ? '切到后摄' : '切到前摄'}</Text>
              </View>
              <View
                className={`motion-live-record ${!cameraReady ? 'motion-button-disabled' : ''}`}
                onClick={recording ? handleStopRecording : handleStartRecording}
              >
                <View className={`motion-live-record-icon ${recording ? 'motion-live-record-icon-stop' : ''}`} />
                <Text>{recording ? '停止并上传' : '开始录制'}</Text>
              </View>
            </View>
            <Text className='motion-live-note'>
              实时预览不会被直接录进原片；停止后自动上传，由服务器生成可保存的高清 MP4。
            </Text>
          </>
        )}

        {captureMode === 'upload' && (
          <>
            <View className='motion-upload-panel'>
              <Text className='motion-upload-title'>已有视频也可以直接制作</Text>
              <Text className='motion-upload-detail'>支持相册中的 MP4 / MOV，最长 30 秒、最大 100MB。</Text>
            </View>
            <View className='motion-button motion-button-primary' onClick={handleChooseVideo}>
              <Text>{video ? '更换相册视频' : '选择相册视频'}</Text>
            </View>
          </>
        )}
        {video && (
          <View className='motion-file'>
            <Text className='motion-file-name'>{video.name}</Text>
            <Text className='motion-file-meta'>
              {formatSize(video.size)} · {Math.round(video.duration)} 秒
            </Text>
          </View>
        )}
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>4. 生成通用 MP4</Text>
        <Text className='motion-hint'>
          成片会保留原音频，并带低调的“教链”标识。原视频和成片最多保留 24 小时。
        </Text>
        <View className='motion-status'>
          <View className='motion-status-heading'>
            <Text className='motion-status-stage'>{statusPresentation.stage}</Text>
            <Text className='motion-status-percent'>{Math.round(progress)}%</Text>
          </View>
          <View className='motion-progress-track'>
            <View className='motion-progress-value' style={{ width: `${progress}%` }} />
          </View>
          <Text className='motion-status-text'>{statusPresentation.title}</Text>
          <Text className='motion-status-detail'>{statusPresentation.detail}</Text>
        </View>
        <View
          className={`motion-button motion-button-primary ${phase !== 'uploaded' || recording ? 'motion-button-disabled' : ''}`}
          onClick={handleGenerate}
        >
          <Text>
            {paying
              ? '正在处理…'
              : selectedPriceCents > 0
                ? `支付 ${formatPrice(selectedPriceCents)} 并生成`
                : '免费生成'}
          </Text>
        </View>
      </View>

      {checkout && job?.paymentStatus !== 'paid' && (
        <View className='motion-card motion-payment-card'>
          <Text className='motion-section-title'>等待付款</Text>
          <Text className='motion-payment-price'>
            {formatPrice(checkout.order.totalAmountCents)}
          </Text>
          <Text className='motion-hint'>
            支付成功后才会占用服务器算力开始生成。付款将在当前小程序内直接调起微信支付。
          </Text>
          <View className='motion-payment-actions'>
            <View className='motion-button motion-button-secondary' onClick={handleRetryPayment}>
              <Text>{paying ? '正在调起…' : '重新支付'}</Text>
            </View>
            <View className='motion-button motion-button-primary' onClick={handleCheckPayment}>
              <Text>{paying ? '正在查询…' : '刷新支付状态'}</Text>
            </View>
          </View>
        </View>
      )}

      {job?.status === 'done' && (
        <View className='motion-card'>
          <Text className='motion-section-title'>5. 预览并保存成片</Text>
          {previewState === 'downloading' && (
            <View className='motion-preview-state'>
              <Text className='motion-preview-title'>正在准备本地 MP4…</Text>
              <Text className='motion-preview-detail'>
                成片已经生成，正在下载完整文件用于可靠预览和保存。
              </Text>
            </View>
          )}
          {previewUrl && previewState === 'ready' && (
            <Video
              className='motion-video'
              src={previewUrl}
              controls
              objectFit='contain'
              onError={() => {
                setPreviewState('error')
                Taro.showToast({ title: '本地视频加载失败，请重试', icon: 'none' })
              }}
            />
          )}
          {previewState === 'error' && (
            <View className='motion-preview-state motion-preview-state-error'>
              <Text className='motion-preview-title'>成片已完成，但本地预览准备失败</Text>
              <Text className='motion-preview-detail'>请检查网络后重新加载，不需要再次生成特效。</Text>
              <View
                className='motion-button motion-button-secondary'
                onClick={() => {
                  if (!job?.id) return
                  void prepareCompletedVideo(job.id, true).catch((error: any) => {
                    Taro.showToast({
                      title: error?.message || '重新加载失败',
                      icon: 'none',
                      duration: 3000
                    })
                  })
                }}
              >
                <Text>重新加载成片</Text>
              </View>
            </View>
          )}
          {previewFilename && (
            <Text className='motion-output-name'>文件名：{previewFilename}</Text>
          )}
          <View
            className={`motion-button motion-button-primary ${saving || previewState === 'downloading' ? 'motion-button-disabled' : ''}`}
            onClick={handleSave}
          >
            <Text>{saving ? '正在保存…' : '保存到相册'}</Text>
          </View>
          <View className='motion-button motion-button-secondary' onClick={handleReset}>
            <Text>制作另一条视频</Text>
          </View>
          <Text className='motion-privacy'>下载无需转发或关注，可直接保存。</Text>
        </View>
      )}
    </View>
  )
}
