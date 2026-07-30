import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Image, RichText } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import MarkdownIt from 'markdown-it'
import { knowledgeService } from '@/services/knowledgeService'
import { authService } from '@/services/authService'
import { Icon } from '@/components/Icon'
import { Book as BookIcon } from 'lucide-react'
import { Notice, Lock } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getKnowledgeBookSource, groupKnowledgeBooks } from '@/utils/knowledgeBooks'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

type StructuredBookContent = {
  markdown?: string
  html?: string
  disclaimer?: string
  imagePrompts?: Array<{
    title?: string
    intent?: string
    prompt?: string
  }>
}

type NormalizedBookContent = {
  html: string
  markdown: string
  disclaimer: string
  prompts: StructuredBookContent['imagePrompts']
}

const markdownRenderer = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: false
})

function renderBookMarkdown(markdown: string) {
  return markdownRenderer.render(String(markdown || ''))
}

function normalizeBookContent(content: unknown): NormalizedBookContent {
  if (typeof content === 'string') {
    return {
      html: '',
      markdown: content,
      disclaimer: '',
      prompts: [] as StructuredBookContent['imagePrompts']
    }
  }

  if (content && typeof content === 'object') {
    const structured = content as StructuredBookContent
    const html = typeof structured.html === 'string' && structured.html.trim() ? structured.html : ''
    const markdown = typeof structured.markdown === 'string' && structured.markdown.trim() ? structured.markdown : ''

    return {
      html,
      markdown,
      disclaimer: structured.disclaimer || '',
      prompts: Array.isArray(structured.imagePrompts) ? structured.imagePrompts : []
    }
  }

  return {
    html: '',
    markdown: '',
    disclaimer: '',
    prompts: [] as StructuredBookContent['imagePrompts']
  }
}

export default function BookDetail() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const bookId = router.params?.id
  const [book, setBook] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [relatedBooks, setRelatedBooks] = useState<any[]>([])

  const loadBook = useCallback(async () => {
    if (!bookId) {
      setErrorMsg('缺少书籍 ID')
      setLoading(false)
      return
    }

    if (!authService.getAuthSession({ normalize: true }).isAuthenticated) {
      // 书籍详情和同书推荐均依赖登录接口；游客不发起必然返回 401 的请求。
      setBook(null)
      setRelatedBooks([])
      setLoading(false)
      setErrorMsg('登录后可查看书籍内容')
      return
    }

    setLoading(true)
    setBook(null)
    setErrorMsg('')
    setRelatedBooks([])

    const res = await knowledgeService.getKnowledgeBook({ id: bookId })
    if (!res) {
      setLoading(false)
      setErrorMsg('加载失败，请稍后重试')
      return
    }

    setBook(res.book)
    setHasAccess(res.hasAccess ?? false)

    try {
      const listRes = await knowledgeService.listKnowledgeBooks({
        is_published: true,
        page: 0,
        limit: 50
      })
      const collectionSlug = getKnowledgeBookSource(res.book?.content)?.collectionSlug
      if (collectionSlug && listRes?.books?.length) {
        const collection = groupKnowledgeBooks(listRes.books).find((item) => item.slug === collectionSlug)
        const siblings = (collection?.books || []).filter((item) => item.id !== res.book.id)
        setRelatedBooks(siblings)
      }
    } catch (listError) {
      console.error('[knowledge] load related books:', listError)
      setRelatedBooks([])
    } finally {
      setLoading(false)
    }
  }, [bookId])

  useDidShow(() => {
    void loadBook()
  })

  const normalizedContent = normalizeBookContent(book?.content)
  const renderedMarkdown = normalizedContent.markdown
    ? renderBookMarkdown(normalizedContent.markdown)
    : ''
  const source = getKnowledgeBookSource(book?.content)
  const canReadContent = hasAccess || book?.is_free

  if (loading) {
    return (
      <View className={`book-detail-page theme-${effectiveTheme}`}>
        <View className='loading-wrap'>
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  if (errorMsg && !book) {
    const returnTo = `/content/knowledge/book-detail?id=${encodeURIComponent(bookId || '')}`
    return (
      <View className={`book-detail-page theme-${effectiveTheme}`}>
        <View className='error-wrap'>
          <View className='error-icon'><Notice size={48} color='#CF6D4E' /></View>
          <Text className='error-text'>{errorMsg}</Text>
          {errorMsg === '登录后可查看书籍内容' ? (
            <Text className='error-action' onClick={() => Taro.navigateTo({ url: authService.buildLoginUrl(returnTo) })}>去登录</Text>
          ) : (
            <Text className='error-action' onClick={() => Taro.navigateBack()}>返回上一页</Text>
          )}
        </View>
      </View>
    )
  }

  if (!book) {
    return (
      <View className={`book-detail-page theme-${effectiveTheme}`}>
        <View className='error-wrap'>
          <Text className='error-text'>书籍不存在或已下架</Text>
          <Text className='error-action' onClick={() => Taro.navigateBack()}>返回</Text>
        </View>
      </View>
    )
  }

  if (!canReadContent) {
    return (
      <View className={`book-detail-page theme-${effectiveTheme}`}>
        <View className='paywall-wrap'>
          <View className='paywall-icon'><Lock size={48} color='#CF6D4E' /></View>
          <Text className='paywall-title'>订阅后可读</Text>
          <Text className='paywall-desc'>这本书需要订阅知识库会员后才能查看完整内容。</Text>
          <View className='paywall-btn' onClick={() => Taro.navigateBack()}>
            <Text>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={`book-detail-page theme-${effectiveTheme}`}>
      <ScrollView className='content-scroll' scrollY>
        <View className='book-body'>
          <View className='book-cover-wrap'>
            {book.cover_image ? (
              <Image
                className='book-cover'
                src={book.cover_image}
                mode='aspectFill'
              />
            ) : (
              <View className='book-cover-placeholder'>
                <Icon component={BookIcon} size={48} color='#9ca3af' />
              </View>
            )}
          </View>

          <Text className='book-title'>{book.title || '未命名书籍'}</Text>
          {book.author && (
            <Text className='book-author'>作者：{book.author}</Text>
          )}
          {book.summary && (
            <Text className='book-summary'>{book.summary}</Text>
          )}

          <View className='book-badges'>
            <Text className={`book-badge ${book.is_free ? 'free' : 'paid'}`}>
              {book.is_free ? '免费内容' : '付费内容'}
            </Text>
            {source?.noteType === 'overview' && (
              <Text className='book-badge overview'>专题总览</Text>
            )}
            {source?.noteType === 'chapter' && (
              <Text className='book-badge chapter'>{source.chapterTitle || '专题分篇'}</Text>
            )}
          </View>

          {normalizedContent.disclaimer && (
            <View className='disclaimer-card'>
              <Text className='disclaimer-badge'>解读型笔记</Text>
              <Text className='disclaimer-text'>{normalizedContent.disclaimer}</Text>
            </View>
          )}

          {book.audio_url && (
            <View className='audio-wrap'>
              <Text className='audio-label'>AI 讲解音频</Text>
              <View
                className='audio-btn'
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

          <Text className='content-section-title'>内容详情</Text>
          {renderedMarkdown ? (
            <View className='content-markdown'>
              <RichText nodes={renderedMarkdown} />
            </View>
          ) : normalizedContent.html ? (
            <View className='content-html'>
              <RichText nodes={normalizedContent.html} />
            </View>
          ) : (
            <Text className='content-fallback'>
              {book.summary || '暂无详细内容'}
            </Text>
          )}

          {relatedBooks.length > 0 && (
            <View className='related-section'>
              <Text className='content-section-title'>同书专题</Text>
              <View className='related-list'>
                {relatedBooks.map((item) => (
                  <View
                    key={item.id}
                    className='related-card'
                    onClick={() => Taro.navigateTo({ url: `/content/knowledge/book-detail?id=${item.id}` })}
                  >
                    <Text className='related-title'>{item.title}</Text>
                    <Text className='related-desc' numberOfLines={2}>{item.summary || '点击继续阅读'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {normalizedContent.prompts.length > 0 && (
            <View className='related-section'>
              <Text className='content-section-title'>配图提示词</Text>
              <View className='related-list'>
                {normalizedContent.prompts.map((item, index) => (
                  <View key={`${item?.title || 'prompt'}-${index}`} className='prompt-card'>
                    <Text className='prompt-title'>{item?.title || `配图提示词 ${index + 1}`}</Text>
                    {item?.intent && (
                      <Text className='prompt-intent'>用途：{item.intent}</Text>
                    )}
                    <Text className='prompt-body'>{item?.prompt || '暂无提示词'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
