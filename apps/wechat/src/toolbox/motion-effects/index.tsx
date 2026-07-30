import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View, Video } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { API_BASE_URL, request } from '@/utils/request'
import { authService } from '@/services/authService'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
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

interface CheckoutResponse {
  job: MotionJob
  order: {
    id: string
    totalAmountCents: number
    totalAmountYuan: number
    status: string
  }
  paymentInfo: {
    paymentUrl?: string
    description: string
  }
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

const MOTION_STYLES = [
  { key: 'aurora', name: '极光流体', colors: ['#46e6d3', '#5c7cff', '#ef68d7'] },
  { key: 'cyber', name: '赛博霓虹', colors: ['#31c7ff', '#7857ff', '#ff3cb7'] },
  { key: 'lava', name: '熔岩脉冲', colors: ['#ffd447', '#ff7a1a', '#e72b2b'] },
  { key: 'candy', name: '糖果派对', colors: ['#ff7aa8', '#ffe167', '#67e6c3'] },
  { key: 'ice', name: '冰晶折射', colors: ['#e9fbff', '#72c7ff', '#9e9cff'] },
  { key: 'galaxy', name: '星云跃迁', colors: ['#3558d8', '#8b48d9', '#ee4b9b'] },
  { key: 'emerald', name: '翡翠能量', colors: ['#29d673', '#20b9b0', '#c8ef43'] },
  { key: 'gold', name: '鎏金光幕', colors: ['#fff1a8', '#e9b949', '#b87822'] }
]

const MAX_SIZE_MB = 100
const MAX_DURATION_SECONDS = 30
const TERMINAL: JobStatus[] = ['done', 'failed', 'expired']
const TRANSFER_TIMEOUT = 15 * 60 * 1000

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
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [job, setJob] = useState<MotionJob | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedStyleKey, setSelectedStyleKey] = useState('aurora')
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

  const optionsLocked = ['creating', 'uploading', 'uploaded', 'enqueueing', 'queued'].includes(phase)
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
    }
  }, [])

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  const ensureDownloadUrl = async (jobId: string) => {
    const data = await callApi<DownloadResponse>({
      url: `/api/toolbox/motion-effects/jobs/${jobId}/download-url`,
      method: 'POST'
    })
    setPreviewUrl(data.url)
    return data
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
            await ensureDownloadUrl(current.id)
            Taro.showToast({ title: '特效视频已生成', icon: 'success' })
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
        sourceType: ['album', 'camera'],
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
      if (nextVideo.size <= 0 || nextVideo.size > MAX_SIZE_MB * 1024 * 1024) {
        Taro.showToast({ title: `视频需小于 ${MAX_SIZE_MB}MB`, icon: 'none' })
        return
      }
      if (nextVideo.duration > MAX_DURATION_SECONDS) {
        Taro.showToast({ title: `视频需小于 ${MAX_DURATION_SECONDS} 秒`, icon: 'none' })
        return
      }
      stopPolling()
      setVideo(nextVideo)
      setPreviewUrl('')
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
          bgmKey: 'original'
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
      Taro.showToast({ title: '视频已上传', icon: 'success' })
    } catch (error: any) {
      const message = String(error?.errMsg || error?.message || '')
      if (message.includes('cancel')) return
      setPhase('idle')
      setJob(null)
      Taro.showToast({ title: message || '选择或上传失败', icon: 'none', duration: 3000 })
    }
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

  const copyPaymentLink = async (paymentUrl: string) => {
    await Taro.setClipboardData({ data: paymentUrl })
    await Taro.showModal({
      title: '支付链接已复制',
      content: '请在手机浏览器中粘贴并打开，完成支付宝支付后回到本页，点击“我已完成支付”。',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const createCheckout = async (jobId: string) => {
    setPaying(true)
    try {
      const created = await callApi<CheckoutResponse>({
        url: `/api/toolbox/motion-effects/jobs/${jobId}/order`,
        method: 'POST',
        data: { returnUrlOnly: true }
      })
      const paymentUrl = String(created.paymentInfo?.paymentUrl || '')
      if (!paymentUrl) throw new Error('支付链接生成失败，请稍后重试')
      setCheckout(created)
      setJob(created.job)
      await copyPaymentLink(paymentUrl)
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

  const handleCopyPayment = async () => {
    const paymentUrl = String(checkout?.paymentInfo?.paymentUrl || '')
    if (!paymentUrl) return
    try {
      await copyPaymentLink(paymentUrl)
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '复制失败', icon: 'none' })
    }
  }

  const handleCheckPayment = async () => {
    if (!job?.id || paying) return
    setPaying(true)
    try {
      const current = await callApi<MotionJob>({
        url: `/api/toolbox/motion-effects/jobs/${job.id}/payment-status`
      })
      setJob(current)
      if (current.paymentStatus !== 'paid') {
        Taro.showToast({ title: '暂未收到支付结果，请稍后再试', icon: 'none' })
        return
      }
      await enqueueUploadedJob(current.id)
    } catch (error: any) {
      setPhase('uploaded')
      Taro.showToast({ title: error?.message || '支付状态查询失败', icon: 'none' })
    } finally {
      setPaying(false)
    }
  }

  const changeOption = (change: () => void) => {
    if (optionsLocked) {
      Taro.showToast({ title: '本次参数已锁定，更换视频后可重新选择', icon: 'none' })
      return
    }
    change()
  }

  const handleSave = async () => {
    if (!job?.id || !job.canDownload) return
    setSaving(true)
    try {
      const data = await ensureDownloadUrl(job.id)
      const token = String(Taro.getStorageSync('token') || '').trim()
      const url = data.proxyUrl
        ? `${API_BASE_URL.replace(/\/+$/, '')}${data.proxyUrl}`
        : data.url
      const downloaded = await Taro.downloadFile({
        url,
        timeout: TRANSFER_TIMEOUT,
        header: data.proxyUrl && token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (downloaded.statusCode !== 200 || !downloaded.tempFilePath) {
        throw new Error(`下载失败（${downloaded.statusCode}）`)
      }
      await Taro.saveVideoToPhotosAlbum({ filePath: downloaded.tempFilePath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败', icon: 'none', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  const statusText = (() => {
    if (phase === 'creating') return '正在创建临时任务'
    if (phase === 'uploading') return `正在上传 ${uploadProgress}%`
    if (phase === 'uploaded') return '视频已上传，可以开始生成'
    if (phase === 'enqueueing') return '正在提交任务'
    if (job?.status === 'queued') {
      const ahead = job.queueInfo?.jobsAhead || 0
      return ahead > 0 ? `排队中，前面还有 ${ahead} 个任务` : '排队中，马上开始'
    }
    if (job?.status === 'processing') return `正在生成 ${job.progress}%`
    if (job?.status === 'done') return '特效视频已完成'
    if (job?.status === 'failed') return job.errorMessage || '生成失败'
    if (job?.status === 'expired') return '视频已过期，请重新生成'
    return '选择视频后会自动上传'
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
        <Text className='motion-section-title'>选择视觉风格</Text>
        <Text className='motion-hint'>8 种风格使用同一套手指追踪逻辑，只改变光膜的色彩、流速与质感。</Text>
        <View className='motion-style-grid'>
          {MOTION_STYLES.map((style) => (
            <View
              key={style.key}
              className={`motion-style ${selectedStyleKey === style.key ? 'motion-style-active' : ''}`}
              onClick={() => changeOption(() => setSelectedStyleKey(style.key))}
            >
              <View className='motion-style-colors'>
                {style.colors.map((color) => (
                  <View key={color} className='motion-style-color' style={{ backgroundColor: color }} />
                ))}
              </View>
              <Text className='motion-style-name'>{style.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='motion-card'>
        <Text className='motion-section-title'>选择下载规格</Text>
        <Text className='motion-hint'>
          预览免费。视频导出会持续占用服务器计算、临时存储和下载带宽，免费资源无法长期支撑，因此下载按规格收费。
        </Text>
        <View
          className={`motion-option ${exportQuality === 'standard' ? 'motion-option-active' : ''}`}
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
          className={`motion-option ${exportQuality === 'hd' ? 'motion-option-active' : ''}`}
          onClick={() => changeOption(() => setExportQuality('hd'))}
        >
          <View>
            <Text className='motion-option-title'>高清版 · 1080p</Text>
            <Text className='motion-option-desc'>更清晰，适合发布短视频</Text>
          </View>
          <Text className='motion-option-price'>{formatPrice(prices.hdCents)}</Text>
        </View>
        <View
          className={`motion-option ${queueTier === 'priority' ? 'motion-option-priority' : ''}`}
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
        <Text className='motion-section-title'>1. 选择双手动作视频</Text>
        <Text className='motion-hint'>建议双手完整入镜，视频不超过 30 秒、100MB。</Text>
        <View className='motion-button motion-button-primary' onClick={handleChooseVideo}>
          <Text>{video ? '更换视频' : '选择视频'}</Text>
        </View>
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
        <Text className='motion-section-title'>2. 生成通用 MP4</Text>
        <Text className='motion-hint'>
          成片会保留原音频，并带低调的“教链”标识。原视频和成片最多保留 24 小时。
        </Text>
        <View className='motion-status'>
          <View className='motion-progress-track'>
            <View className='motion-progress-value' style={{ width: `${progress}%` }} />
          </View>
          <Text className='motion-status-text'>{statusText}</Text>
        </View>
        <View
          className={`motion-button motion-button-primary ${phase !== 'uploaded' ? 'motion-button-disabled' : ''}`}
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
            支付成功后才会占用服务器算力开始生成。请在浏览器完成支付宝支付，再返回这里确认。
          </Text>
          <View className='motion-payment-actions'>
            <View className='motion-button motion-button-secondary' onClick={handleCopyPayment}>
              <Text>重新复制支付链接</Text>
            </View>
            <View className='motion-button motion-button-primary' onClick={handleCheckPayment}>
              <Text>{paying ? '正在查询…' : '我已完成支付'}</Text>
            </View>
          </View>
        </View>
      )}

      {previewUrl && job?.status === 'done' && (
        <View className='motion-card'>
          <Text className='motion-section-title'>3. 保存成片</Text>
          <Video className='motion-video' src={previewUrl} controls objectFit='contain' />
          <View className='motion-button motion-button-primary' onClick={handleSave}>
            <Text>{saving ? '正在保存…' : '保存到相册'}</Text>
          </View>
          <Text className='motion-privacy'>下载无需转发或关注，可直接保存。</Text>
        </View>
      )}
    </View>
  )
}
