import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

interface ActionDetailData {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
}

export default function ActionDetailPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const id = router.params?.id || ''
  const [action, setAction] = useState<ActionDetailData | null>(null)

  const cacheKey = useMemo(() => (id ? `action_detail_${id}` : ''), [id])
  const positions = action?.positions ?? []
  const attrs = action?.attrs ?? []

  useEffect(() => {
    if (!cacheKey) return
    const cache = Taro.getStorageSync(cacheKey)
    if (cache && typeof cache === 'object') {
      setAction(cache as ActionDetailData)
      return
    }
    setAction(null)
  }, [cacheKey])

  const handleCopyVideoUrl = () => {
    if (!action?.url) return
    Taro.setClipboardData({
      data: action.url,
      success: () => {
        Taro.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  }

  return (
    <View className={`action-detail-page theme-${effectiveTheme}`}>
      <View className="action-card">
        <Text className="title">{action?.name || '动作详情'}</Text>
        {action?.type ? <Text className="type-tag">{action.type}</Text> : null}

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

        {action?.url ? (
          <View className="section">
            <Text className="section-title">演示视频链接</Text>
            <Text className="video-url" selectable>{action.url}</Text>
            <View className="copy-btn" onClick={handleCopyVideoUrl}>
              <Text>复制视频链接</Text>
            </View>
          </View>
        ) : null}

        {!action ? (
          <View className="empty-state">
            <Text className="empty-text">未找到动作详情，请返回动作库重新进入。</Text>
            {id ? <Text className="id-hint">动作 ID: {id}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}
