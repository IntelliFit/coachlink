import { View, Text, Image } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { isLikelyVideoUrl, resolveWeappMediaUrl } from '@/utils/mediaUrl'
import { trainingService } from '@/services/trainingService'

interface ActionDetailData {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
  video_url?: string | null
  reference_image_url?: string | null
}

export default function ActionDetailPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const id = router.params?.id || ''
  const [action, setAction] = useState<ActionDetailData | null>(null)
  const [coachNote, setCoachNote] = useState('')
  const [loading, setLoading] = useState(true)
  const instanceId = router.params?.instanceId || ''
  const dayIndex = Number(router.params?.dayIndex || 0)
  const actionIndex = Number(router.params?.actionIndex ?? -1)

  const cacheKey = useMemo(() => (id ? `action_detail_${id}` : ''), [id])
  const positions = action?.positions ?? []
  const attrs = action?.attrs ?? []
  const referenceImageUrl = resolveWeappMediaUrl(action?.reference_image_url)
  const demoUrl = resolveWeappMediaUrl(action?.url || action?.video_url)

  useEffect(() => {
    let disposed = false
    let receivedContext = false
    const channel = Taro.getCurrentInstance().page?.getOpenerEventChannel?.()
    const receive = (data: { action: ActionDetailData; coachNote?: string }) => {
      if (disposed || data.action?.id !== id) return
      receivedContext = true
      setAction(data.action)
      setCoachNote(data.coachNote || '')
      setLoading(false)
    }
    channel?.on('teaching', receive)
    // Older action-library routes still provide the existing action-detail cache.
    if (!receivedContext && !instanceId && cacheKey) {
      const cache = Taro.getStorageSync(cacheKey)
      if (cache && typeof cache === 'object') setAction(cache)
    }
    const loadFallback = async () => {
      if (receivedContext || !instanceId) { setLoading(false); return }
      try {
        const result = await trainingService.getInstanceResult({ id: instanceId }, { showErrorToast: false })
        if (disposed || receivedContext) return
        const data = result.data
        const found = data?.actions?.[id]
        if (found) setAction({ ...found, id })
        const day = data?.instance?.training_days?.find(item => Number(item.dayIndex) === dayIndex)
        const item = day?.actionSets?.[actionIndex] as any
        if (item && (item.action_id || item.actionId) === id) setCoachNote(item.params?.note || item.note || '')
      } finally {
        if (!disposed) setLoading(false)
      }
    }
    void loadFallback().catch(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true; channel?.off('teaching', receive) }
  }, [cacheKey, id, instanceId, dayIndex, actionIndex])

  const handleCopyVideoUrl = () => {
    if (!demoUrl) return
    Taro.setClipboardData({
      data: demoUrl,
      success: () => {
        Taro.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  }

  const handlePreviewReference = () => {
    if (!referenceImageUrl) return
    Taro.previewImage({
      urls: [referenceImageUrl],
      current: referenceImageUrl
    })
  }

  const handlePreviewVideo = async () => {
    if (!demoUrl) return
    if (!isLikelyVideoUrl(demoUrl)) {
      handleCopyVideoUrl()
      return
    }
    try {
      await Taro.previewMedia({
        sources: [{ url: demoUrl, type: 'video' }],
        current: 0
      })
    } catch {
      Taro.navigateTo({
        url: `/common/common/video-player?url=${encodeURIComponent(demoUrl)}&title=${encodeURIComponent(action?.name || '动作演示')}`
      }).catch(() => handleCopyVideoUrl())
    }
  }

  return (
    <View className={`action-detail-page theme-${effectiveTheme}`}>
      <View className="action-card">
        <Text className="title">{action?.name || '动作详情'}</Text>
        {action?.type ? <Text className="type-tag">{action.type}</Text> : null}
        {!!coachNote && <View className="section">
          <Text className="section-title">本次教练要求</Text>
          <Text className="section-content">{coachNote}</Text>
        </View>}
        {action && !action.detail && !demoUrl && !referenceImageUrl && <View className="section">
          <Text className="section-content">这个动作暂未提供讲解素材。</Text>
        </View>}

        {referenceImageUrl ? (
          <View className="section">
            <Text className="section-title">参考图</Text>
            <Image className="reference-image" src={referenceImageUrl} mode="aspectFit" onClick={handlePreviewReference} />
          </View>
        ) : null}

        {action?.detail ? (
          <View className="section">
            <Text className="section-title">动作说明</Text>
            <Text className="section-content">{action.detail}</Text>
          </View>
        ) : null}

        {positions.length > 0 ? (
          <View className="section">
            <Text className="section-title">训练部位</Text>
            <View className="tag-list">
              {positions.map((item, index) => (
                <Text key={`${item}-${index}`} className="tag">{item}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {attrs.length > 0 ? (
          <View className="section">
            <Text className="section-title">动作属性</Text>
            <View className="tag-list">
              {attrs.map((item, index) => (
                <Text key={`${item}-${index}`} className="tag">{item}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {demoUrl ? (
          <View className="section">
            <Text className="section-title">演示素材</Text>
            <View className="media-card">
              <Text className="media-title">{isLikelyVideoUrl(demoUrl) ? '可直接预览动作演示视频' : '当前演示素材为外部链接，可先复制后查看'}</Text>
              <Text className="video-url" selectable>{demoUrl}</Text>
              <View className="media-actions">
                <View className="primary-btn" onClick={handlePreviewVideo}>
                  <Text>{isLikelyVideoUrl(demoUrl) ? '预览演示' : '复制链接'}</Text>
                </View>
                <View className="secondary-btn" onClick={handleCopyVideoUrl}>
                  <Text>复制地址</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {!action ? (
          <View className="empty-state">
            <Text className="empty-text">{loading ? '正在读取动作讲解…' : '暂未读到动作详情，请返回后重试。'}</Text>
            {id ? <Text className="id-hint">动作 ID: {id}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}
