import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Video, RichText } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { knowledgeService } from '@/services/knowledgeService'
import { Icon } from '@/components/Icon'
import { FileText, Video as VideoIcon } from 'lucide-react'
import { Notice } from '@nutui/icons-react-taro'
import './index.scss'

export default function NodeDetail() {
  const router = useRouter()
  const nodeId = router.params?.id
  const [node, setNode] = useState<any>(null)
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const loadNode = useCallback(async () => {
    if (!nodeId) {
      setErrorMsg('缺少节点 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setNode(null)
    setErrorMsg('')
    const res = await knowledgeService.getNode(nodeId)
    setLoading(false)
    if (res) {
      setNode(res.node)
      setArticles(res.articles || [])
      return
    }
    setErrorMsg('加载失败，请稍后重试')
  }, [nodeId])

  useDidShow(() => {
    loadNode()
  })

  function getContentBody() {
    if (!node?.content) return ''
    const c = node.content
    if (typeof c === 'string') return c
    if (typeof c === 'object' && c !== null && typeof (c as any).body === 'string') return (c as any).body
    if (typeof c === 'object' && c !== null && typeof (c as any).html === 'string') return (c as any).html
    return ''
  }

  function getVideoUrl() {
    if (!node?.content) return ''
    const c = node.content
    if (typeof c === 'object' && c !== null && typeof (c as any).video_url === 'string') return (c as any).video_url
    return ''
  }

  const contentBody = getContentBody()
  const videoUrl = getVideoUrl()

  if (loading) {
    return (
      <View className="node-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">加载中...</Text>
        </View>
        <View className="loading-wrap">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  if (errorMsg && !node) {
    return (
      <View className="node-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">节点详情</Text>
        </View>
        <View className="error-wrap">
          <View className="error-icon"><Notice size={48} color="#CF6D4E" /></View>
          <Text className="error-text">{errorMsg}</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回上一页</Text>
        </View>
      </View>
    )
  }

  if (!node) {
    return (
      <View className="node-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">节点详情</Text>
        </View>
        <View className="error-wrap">
          <Text className="error-text">内容不存在或已下架</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="node-detail-page">
      <View className="nav-bar">
        <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
        <Text className="nav-title" numberOfLines={1}>{node.title || '详情'}</Text>
      </View>
      <ScrollView className="content-scroll" scrollY>
        <View className="node-body">
          <View className="node-type-badge">
            <Icon
              component={node.node_type === 'video' ? VideoIcon : FileText}
              size={14}
              color="#F28631"
            />
            <Text>
              {node.node_type === 'video' ? '视频' : '文章'}
            </Text>
          </View>

          <Text className="node-title">{node.title || '未命名'}</Text>
          {node.description && (
            <Text className="node-desc">{node.description}</Text>
          )}

          {node.body_region && node.body_region.length > 0 && (
            <View className="node-tags">
              {node.body_region.map((r: string, i: number) => (
                <Text key={i} className="node-tag">{r}</Text>
              ))}
            </View>
          )}

          {videoUrl && (
            <View className="video-wrap">
              <Video
                src={videoUrl}
                controls
                autoplay={false}
                className="node-video"
              />
            </View>
          )}

          {contentBody ? (
            <View className="content-html">
              <RichText nodes={contentBody} />
            </View>
          ) : !videoUrl && (
            <Text className="content-fallback">
              {node.description || '暂无详细内容'}
            </Text>
          )}

          {articles && articles.length > 0 && (
            <View className="related-articles">
              <Text className="related-title">相关教练文章</Text>
              {articles.map((a: any) => (
                <View
                  key={a.id}
                  className="article-item"
                  onClick={() => Taro.navigateTo({ url: `/content/content-detail?id=${a.id}` })}
                >
                  <Text className="article-item-title" numberOfLines={1}>{a.title}</Text>
                  {a.coaches?.name && (
                    <Text className="article-item-author">{a.coaches.name}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
