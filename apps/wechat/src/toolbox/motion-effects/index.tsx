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

type JobStatus = 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
type Phase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'

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
}

interface DownloadResponse {
  url: string
  proxyUrl?: string
  signedUrl?: string
  filename: string
}

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
      setUploadProgress(0)
      setPhase('creating')
      const created = await callApi<CreateResponse>({
        url: '/api/toolbox/motion-effects/create-upload-url',
        method: 'POST',
        data: {
          originalFilename: nextVideo.name,
          contentType: nextVideo.contentType,
          fileSizeBytes: nextVideo.size,
          durationSeconds: nextVideo.duration
        }
      })
      setJob(created.job)
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

  const handleGenerate = async () => {
    if (!job?.id || phase !== 'uploaded') return
    try {
      setPhase('enqueueing')
      const queued = await callApi<MotionJob>({
        url: `/api/toolbox/motion-effects/jobs/${job.id}/enqueue`,
        method: 'POST'
      })
      setJob(queued)
      setPhase('queued')
      pollJob(queued.id)
      Taro.showToast({ title: '已开始生成', icon: 'success' })
    } catch (error: any) {
      setPhase('uploaded')
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none', duration: 3000 })
    }
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
          <Text>开始生成</Text>
        </View>
      </View>

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
