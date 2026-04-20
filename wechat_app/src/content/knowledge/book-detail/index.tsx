import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Image, RichText } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { knowledgeService } from '@/services/knowledgeService'
import { Icon } from '@/components/Icon'
import { Book as BookIcon } from 'lucide-react'
import { Notice, Lock } from '@nutui/icons-react-taro'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function BookDetail() {
  const router = useRouter()
  const bookId = router.params?.id
  const [book, setBook] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const loadBook = useCallback(async () => {
    if (!bookId) {
      setErrorMsg('缺少书籍 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setBook(null)
    setErrorMsg('')
    const res = await knowledgeService.getKnowledgeBook({ id: bookId })
    setLoading(false)
    if (res) {
      setBook(res.book)
      setHasAccess(res.hasAccess ?? false)
      return
    }
    setErrorMsg('加载失败，请稍后重试')
  }, [bookId])

  useDidShow(() => {
    loadBook()
  })

  /** 将书籍 content（可能是 string 或 object）转为可渲染的 HTML 字符串 */
  function getContentHtml() {
    if (!book?.content) return ''
    const c = book.content
    if (typeof c === 'string') return c
    if (typeof c === 'object' && c !== null && typeof (c as any).html === 'string') return (c as any).html
    return ''
  }

  const contentHtml = getContentHtml()
  const canReadContent = hasAccess || book?.is_free

  if (loading) {
    return (
      <View className="book-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">书籍详情</Text>
        </View>
        <View className="loading-wrap">
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  if (errorMsg && !book) {
    return (
      <View className="book-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">书籍详情</Text>
        </View>
        <View className="error-wrap">
          <View className="error-icon"><Notice size={48} color="#CF6D4E" /></View>
          <Text className="error-text">{errorMsg}</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回上一页</Text>
        </View>
      </View>
    )
  }

  if (!book) {
    return (
      <View className="book-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">书籍详情</Text>
        </View>
        <View className="error-wrap">
          <Text className="error-text">书籍不存在或已下架</Text>
          <Text className="error-action" onClick={() => Taro.navigateBack()}>返回</Text>
        </View>
      </View>
    )
  }

  if (!canReadContent) {
    return (
      <View className="book-detail-page">
        <View className="nav-bar">
          <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
          <Text className="nav-title">{book.title || '书籍详情'}</Text>
        </View>
        <View className="paywall-wrap">
          <View className="paywall-icon"><Lock size={48} color="#CF6D4E" /></View>
          <Text className="paywall-title">订阅后可见</Text>
          <Text className="paywall-desc">该书籍需要订阅知识库会员后才能查看完整内容</Text>
          <View className="paywall-btn" onClick={() => Taro.navigateBack()}>
            <Text>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="book-detail-page">
      <View className="nav-bar">
        <Text className="nav-back" onClick={() => Taro.navigateBack()}>返回</Text>
        <Text className="nav-title">书籍详情</Text>
      </View>
      <ScrollView className="content-scroll" scrollY>
        <View className="book-body">
          <View className="book-cover-wrap">
            {book.cover_image ? (
              <Image
                className="book-cover"
                src={book.cover_image}
                mode="aspectFill"
              />
            ) : (
              <View className="book-cover-placeholder">
                <Icon component={BookIcon} size={48} color="#9ca3af" />
              </View>
            )}
          </View>

          <Text className="book-title">{book.title || '未命名书籍'}</Text>
          {book.author && (
            <Text className="book-author">作者：{book.author}</Text>
          )}
          {book.summary && (
            <Text className="book-summary">{book.summary}</Text>
          )}

          <View>
            {book.is_free ? (
              <Text className="book-badge free">免费</Text>
            ) : (
              <Text className="book-badge paid">付费</Text>
            )}
          </View>

          {book.audio_url && (
            <View className="audio-wrap">
              <Text className="audio-label">AI 讲解音频</Text>
              <View
                className="audio-btn"
                onClick={() => {
                  const ctx = Taro.createInnerAudioContext()
                  ctx.src = book.audio_url
                  ctx.play()
                  ctx.onEnded(() => ctx.destroy())
                  ctx.onError(() => ctx.destroy())
                }}
              >
                <Text>点击播放</Text>
              </View>
            </View>
          )}

          <Text className="content-section-title">内容详情</Text>
          {contentHtml ? (
            <View className="content-html">
              <RichText nodes={contentHtml} />
            </View>
          ) : (
            <Text className="content-fallback">
              {book.summary || '暂无详细内容'}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
