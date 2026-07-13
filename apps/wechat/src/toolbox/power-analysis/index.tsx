import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, ScrollView, Text, View, Video } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { API_BASE_URL, request } from '@/utils/request'
import { authService } from '@/services/authService'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import { useTheme } from '@/hooks/useTheme'
import './index.scss'

type PowerAnalysisMode = 'pullup' | 'muscleup' | 'dip' | 'pushup' | 'squat'
type PowerAnalysisJobStatus = 'awaiting_upload' | 'queued' | 'processing' | 'done' | 'failed' | 'expired'
type UploadPhase = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'enqueueing' | 'queued' | 'done'

interface PowerAnalysisRepMetric {
  repIndex: number
  displacementM: number
  ascentTimeS: number
  avgPowerW: number
  horsepowerHp: number
  maxVelocityMps: number
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
  }
  reps: PowerAnalysisRepMetric[]
  notes?: string[]
}

interface PowerAnalysisJobDto {
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
  queueInfo?: {
    jobsAhead: number
    queuedAhead: number
    processingAhead: number
    totalQueued: number
  } | null
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
  }
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

const MODE_OPTIONS: Array<{ label: string; value: PowerAnalysisMode; hint: string }> = [
  { label: '引体向上', value: 'pullup', hint: '正面或侧前方，全身入镜' },
  { label: '双力臂', value: 'muscleup', hint: '保留过杠阶段，避免遮挡' },
  { label: '双杠臂屈伸', value: 'dip', hint: '肩、髋和双杠无遮挡' },
  { label: '俯卧撑', value: 'pushup', hint: '侧面拍摄，肩髋都要清楚' },
  { label: '深蹲起身', value: 'squat', hint: '侧前方全身，髋部可见' }
]

const TERMINAL_STATUSES: PowerAnalysisJobStatus[] = ['done', 'failed', 'expired']
const SELECTED_VIDEO_ID = 'power-analysis-selected-video'

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

function uploadPowerAnalysisVideo(params: {
  jobId: string
  filePath: string
  contentType: string
  onProgress: (progress: number) => void
}) {
  return new Promise<void>((resolve, reject) => {
    const token = String(Taro.getStorageSync('token') || '').trim()
    if (!token) {
      reject(new Error('请先登录后再使用视频分析工具'))
      return
    }

    const uploadTask = Taro.uploadFile({
      url: `${API_BASE_URL}/api/toolbox/power-analysis/jobs/${params.jobId}/upload`,
      filePath: params.filePath,
      name: 'file',
      formData: {
        contentType: params.contentType
      },
      header: {
        Authorization: `Bearer ${token}`
      },
      success: (uploadRes: any) => {
        let data: any = uploadRes.data
        if (typeof uploadRes.data === 'string') {
          try {
            data = JSON.parse(uploadRes.data || '{}')
          } catch {
            data = null
          }
        }

        if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300 && data?.success) {
          params.onProgress(100)
          resolve()
          return
        }

        if (uploadRes.statusCode === 413) {
          reject(new Error(data?.message || '视频超过服务器上传限制，请压缩后重试'))
          return
        }

        reject(new Error(data?.message || `上传失败（${uploadRes.statusCode}）`))
      },
      fail: (error: any) => {
        reject(new Error(error?.errMsg || error?.message || '上传失败'))
      }
    }) as any

    if (uploadTask?.progress) {
      uploadTask.progress((res: any) => {
        params.onProgress(Math.max(1, Math.min(99, Number(res?.progress || 0))))
      })
    }
    if (uploadTask?.onProgressUpdate) {
      uploadTask.onProgressUpdate((res: any) => {
        params.onProgress(Math.max(1, Math.min(99, Number(res?.progress || 0))))
      })
    }
  })
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

export default function WechatPowerAnalysisPage() {
  const { effectiveTheme } = useTheme()
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
  const [savingVideo, setSavingVideo] = useState(false)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '功率视频分析',
        path: buildSharePath('/toolbox/power-analysis/index')
      }),
    []
  )

  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0],
    [mode]
  )

  const metrics = job?.metrics || null
  const heightValue = Number(heightCm)
  const weightValue = Number(weightKg)
  const externalLoadValue = Number(externalLoadKg)
  const formReady =
    Number.isFinite(heightValue) &&
    heightValue >= 100 &&
    heightValue <= 250 &&
    Number.isFinite(weightValue) &&
    weightValue >= 30 &&
    weightValue <= 250 &&
    Number.isFinite(externalLoadValue) &&
    externalLoadValue >= 0 &&
    externalLoadValue <= 250
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
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
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
      Taro.showToast({ title: '请先填写有效身高体重', icon: 'none' })
      return
    }

    stopPolling()
    setVideo(nextVideo)
    setJob(null)
    setUploadProgress(0)
    llmRequestedRef.current = null

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
          originalFilename: nextVideo.name,
          contentType: nextVideo.contentType,
          fileSizeBytes: nextVideo.size
        }
      })
      setJob(created.job)

      setPhase('uploading')
      setUploadProgress(1)
      await uploadPowerAnalysisVideo({
        jobId: created.job.id,
        filePath: nextVideo.tempFilePath,
        contentType: nextVideo.contentType,
        onProgress: setUploadProgress
      })

      setPhase('uploaded')
      Taro.showToast({ title: '视频已上传', icon: 'success' })
    } catch (error: any) {
      setPhase('idle')
      setJob(null)
      setUploadProgress(0)
      Taro.showToast({
        title: error?.message || '上传失败',
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
        maxDuration: 30,
        compressed: true,
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
  }

  const handleSaveVideo = async () => {
    if (!job?.id || !job.canDownload) return
    setSavingVideo(true)
    try {
      const data = await callPowerApi<PowerAnalysisDownloadUrlResponseDto>({
        url: `/api/toolbox/power-analysis/jobs/${job.id}/download-url`,
        method: 'POST'
      })
      const token = String(Taro.getStorageSync('token') || '').trim()
      const downloadUrl = data.proxyUrl
        ? `${API_BASE_URL.replace(/\/+$/, '')}${data.proxyUrl}`
        : data.url
      const downloaded = await Taro.downloadFile({
        url: downloadUrl,
        header: data.proxyUrl && token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (downloaded.statusCode !== 200 || !downloaded.tempFilePath) {
        throw new Error(`下载失败（${downloaded.statusCode}）`)
      }
      await Taro.saveVideoToPhotosAlbum({ filePath: downloaded.tempFilePath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      try {
        const data = await callPowerApi<PowerAnalysisDownloadUrlResponseDto>({
          url: `/api/toolbox/power-analysis/jobs/${job.id}/download-url`,
          method: 'POST'
        })
        await Taro.setClipboardData({ data: data.signedUrl || data.url })
        Taro.showToast({ title: '下载失败，链接已复制', icon: 'none', duration: 3000 })
      } catch {
        Taro.showToast({
          title: error?.message || '保存失败',
          icon: 'none',
          duration: 3000
        })
      }
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
    <View className={`power-analysis-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className='analysis-scroll'>
        <View className='page-content'>
          <View className='intro-card'>
            <Text className='intro-kicker'>多动作功率测试</Text>
            <Text className='intro-title'>上传视频，估算功率、马力与最大速度</Text>
            <Text className='intro-desc'>视频仅作为临时分析任务处理，完成后可保存带标注的视频结果。</Text>
          </View>

          <View className='form-card'>
            <Text className='section-title'>测试设置</Text>
            <View className='mode-grid'>
              {MODE_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`mode-card mode-card-${item.value} ${mode === item.value ? 'active' : ''}`}
                  onClick={() => !settingsLocked && setMode(item.value)}
                >
                  <Text className='mode-label'>{item.label}</Text>
                  <Text className='mode-hint'>{item.hint}</Text>
                </View>
              ))}
            </View>

            <View className='input-grid'>
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
              <View className='input-cell'>
                <Text className='input-label'>额外负重 kg</Text>
                <Input
                  className='metric-input load-input'
                  type='digit'
                  value={externalLoadKg}
                  disabled={settingsLocked}
                  onInput={(event) => setExternalLoadKg(String(event.detail.value || ''))}
                />
              </View>
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
                    </View>
                  </View>
                </View>
              ) : (
                <View className='empty-video'>
                  <Text className='empty-video-title'>还没有选择视频</Text>
                  <Text className='empty-video-desc'>建议使用 30 秒内、人物无遮挡、全身动作清晰的视频。</Text>
                </View>
              )}
              <View className={`secondary-action select-video-btn ${isBusy ? 'disabled' : ''}`} onClick={handleChooseVideo}>
                <Text>{video ? '重新选择视频' : '选择视频'}</Text>
              </View>
            </View>

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

            <View className='action-row'>
              <View className={`primary-action start-analysis-btn ${canSubmit ? '' : 'disabled'}`} onClick={handleStart}>
                <Text>{['creating', 'uploading'].includes(phase) ? '上传中' : isBusy ? '处理中' : '开始分析'}</Text>
              </View>
              <View className={`secondary-action reset-btn ${isBusy ? 'disabled' : ''}`} onClick={() => !isBusy && handleReset()}>
                <Text>重置</Text>
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-header'>
              <View>
                <Text className='result-kicker'>{selectedMode.label}</Text>
                <Text className='section-title'>分析结果</Text>
              </View>
              <View className={`save-video-btn ${job?.canDownload && !savingVideo ? '' : 'disabled'}`} onClick={handleSaveVideo}>
                <Text>{savingVideo ? '保存中' : '保存视频'}</Text>
              </View>
            </View>

            {!metrics ? (
              <View className='result-empty'>
                <Text>提交视频后，功率、马力、速度和逐次数据会显示在这里。</Text>
              </View>
            ) : (
              <View>
                <View className='summary-grid'>
                  <View className='summary-item'>
                    <Text className='summary-label'>有效次数</Text>
                    <Text className='summary-value'>{metrics.repCount}</Text>
                  </View>
                  <View className='summary-item'>
                    <Text className='summary-label'>最高功率</Text>
                    <Text className='summary-value'>{formatMetric(metrics.summary.bestPowerW, 0)} W</Text>
                  </View>
                  <View className='summary-item accent'>
                    <Text className='summary-label'>最高马力</Text>
                    <Text className='summary-value'>{formatMetric(metrics.summary.bestHorsepowerHp, 2)} hp</Text>
                  </View>
                  <View className='summary-item'>
                    <Text className='summary-label'>最快速度</Text>
                    <Text className='summary-value'>{formatMetric(metrics.summary.bestVelocityMps, 2)} m/s</Text>
                  </View>
                </View>

                <View className='rep-list'>
                  {metrics.reps.map((rep) => (
                    <View key={rep.repIndex} className='rep-row'>
                      <View className='rep-index'>
                        <Text>#{rep.repIndex}</Text>
                      </View>
                      <View className='rep-main'>
                        <Text className='rep-power'>{formatMetric(rep.avgPowerW, 0)} W · {formatMetric(rep.horsepowerHp, 2)} hp</Text>
                        <Text className='rep-detail'>
                          位移 {formatMetric(rep.displacementM, 2)} m · 上升 {formatMetric(rep.ascentTimeS, 2)} s · 速度 {formatMetric(rep.maxVelocityMps, 2)} m/s
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

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
              {job?.llmSummary ||
                (summaryLoading
                  ? '正在根据结构化指标生成解读...'
                  : '分析完成后，这里会给出训练建议。')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
