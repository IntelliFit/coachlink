import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RichText, Video, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { request } from '@/utils/request'
import { authService } from '@/services/authService'
import './index.scss'

export default function ContentDetail() {
  const router = useRouter()
  const contentId = router.params?.id
  const [content, setContent] = useState<any>(null)
  const [accessTier, setAccessTier] = useState(0)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const loadContent = useCallback(async () => {
    if (!contentId) {
      setErrorMsg('缺少内容 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setContent(null)
    setForbidden(false)
    setErrorMsg('')
    const user = authService.getCurrentUser()
    const res = await request<{ content: any; accessTier: number }>({
      url: '/api/coach/get-content-by-id',
      method: 'POST',
      data: { contentId, viewerId: user?.id },
      showErrorToast: false
    })
    setLoading(false)
    if (res.success && res.data) {
      setContent(res.data.content)
      setAccessTier(res.data.accessTier ?? 0)
      return
    }
    if (res.message?.includes('无权限') || res.message?.includes('权限')) {
      setForbidden(true)
      setContent(null)
      return
    }
    setErrorMsg(res.message || '加载失败')
  }, [contentId])

  useDidShow(() => {
    loadContent()
  })

  const canView = content && (content.required_tier ?? 0) <= accessTier

  if (loading) {
    return (
      <View className="content-detail-page">
        <View className="nav-bar">
          <Text className="nav-title">加载中...</Text>
        </View>
        <View className="loading-wrap">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  if (errorMsg && !content) {
    return (
      <View className="content-detail-page">
        <View className="nav-bar">
          <Text className="nav-title">内容</Text>
        </View>
        <View className="error-wrap">
          <Text className="error-icon">⚠️</Text>
          <Text className="error-text">{errorMsg}</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回上一页</Text>
        </View>
      </View>
    )
  }

  if (forbidden || (content && !canView)) {
    return (
      <View className="content-detail-page">
        <View className="nav-bar">
          <Text className="nav-title">教学内容</Text>
        </View>
        <View className="paywall-wrap">
          <View className="paywall-icon">🔒</View>
          <Text className="paywall-title">订阅后可见</Text>
          <Text className="paywall-desc">该内容需要订阅教练后才能查看，去教练主页订阅吧</Text>
        </View>
      </View>
    )
  }

  if (!content) {
    return (
      <View className="content-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">内容</Text>
        </View>
        <View className="error-wrap">
          <Text className="error-text">内容不存在或已删除</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回</Text>
        </View>
      </View>
    )
  }

  const mediaUrls = content.media_urls || []
  const isVideo = content.content_type === 'video'

  return (
    <View className="content-detail-page">
      <View className="nav-bar">
        <Text className="nav-title">教学内容</Text>
      </View>
      <ScrollView className="content-scroll" scrollY>
        <View className="content-body">
          <Text className="content-title">{content.title || '未命名'}</Text>
          <View className="content-meta">
            <Text>{content.views_count != null ? `浏览 ${content.views_count}` : ''}</Text>
            <Text>{content.created_at ? new Date(content.created_at).toLocaleDateString('zh-CN') : ''}</Text>
          </View>

          {mediaUrls.length > 0 && (
            <View className="content-media">
              {mediaUrls.map((url: string, idx: number) => (
                <View key={idx} className="media-item">
                  {isVideo ? (
                    <Video
                      src={url}
                      controls
                      show-center-play-btn
                      className="media-video"
                    />
                  ) : (
                    <Image
                      src={url}
                      mode="widthFix"
                      className="media-img"
                    />
                  )}
                </View>
              ))}
            </View>
          )}

          {content.content && (
            <View className="content-html">
              <RichText nodes={content.content} />
            </View>
          )}

          {content.tags && Array.isArray(content.tags) && content.tags.length > 0 && (
            <View className="content-tags">
              {content.tags.map((tag: string, idx: number) => (
                <Text key={idx} className="tag">#{tag}</Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
