import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, Image, RichText, Textarea } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import MarkdownIt from 'markdown-it'
import {
  knowledgeService,
  type KnowledgeBookDiscussionComment
} from '@/services/knowledgeService'
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
  mindMap?: {
    title?: string
    description?: string
    data?: MiniMindMapNode[]
  }
  readingGuide?: {
    estimatedMinutes?: number
    suitableFor?: string[]
    goals?: string[]
    prerequisites?: string[]
  }
  keyTakeaways?: string[]
  discussionPrompts?: string[]
  citations?: Array<{
    title?: string
    url?: string
    note?: string
    license?: string
    accessedAt?: string
  }>
}

type MiniMindMapNode = {
  id?: string
  title?: string
  description?: string | null
  children?: MiniMindMapNode[]
}

type NormalizedBookContent = {
  html: string
  markdown: string
  disclaimer: string
  prompts: StructuredBookContent['imagePrompts']
  mindMap: StructuredBookContent['mindMap'] | null
  readingGuide: StructuredBookContent['readingGuide'] | null
  keyTakeaways: string[]
  discussionPrompts: string[]
  citations: NonNullable<StructuredBookContent['citations']>
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
      prompts: [] as StructuredBookContent['imagePrompts'],
      mindMap: null,
      readingGuide: null,
      keyTakeaways: [],
      discussionPrompts: [],
      citations: []
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
      prompts: Array.isArray(structured.imagePrompts) ? structured.imagePrompts : [],
      mindMap: structured.mindMap?.data?.length ? structured.mindMap : null,
      readingGuide: structured.readingGuide || null,
      keyTakeaways: Array.isArray(structured.keyTakeaways) ? structured.keyTakeaways.filter(Boolean) : [],
      discussionPrompts: Array.isArray(structured.discussionPrompts) ? structured.discussionPrompts.filter(Boolean) : [],
      citations: Array.isArray(structured.citations) ? structured.citations.filter((item) => item?.title) : []
    }
  }

  return {
    html: '',
    markdown: '',
    disclaimer: '',
    prompts: [] as StructuredBookContent['imagePrompts'],
    mindMap: null,
    readingGuide: null,
    keyTakeaways: [],
    discussionPrompts: [],
    citations: []
  }
}

function MindMapNodeView({ node, depth = 0 }: { node: MiniMindMapNode; depth?: number }) {
  const children = Array.isArray(node.children) ? node.children : []
  return (
    <View className={`mind-map-node mind-map-depth-${Math.min(depth, 2)}`}>
      <View className='mind-map-node-head'>
        <Text className='mind-map-node-title'>{node.title || '未命名节点'}</Text>
        {node.description ? <Text className='mind-map-node-desc'>{node.description}</Text> : null}
      </View>
      {children.length > 0 && (
        <View className='mind-map-children'>
          {children.map((child, index) => (
            <MindMapNodeView key={child.id || `${child.title || 'node'}-${index}`} node={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  )
}

function formatDiscussionTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN') : ''
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
  const [comments, setComments] = useState<KnowledgeBookDiscussionComment[]>([])
  const [discussionAvailable, setDiscussionAvailable] = useState(true)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<KnowledgeBookDiscussionComment | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  const loadBookComments = useCallback(async (targetBookId: string) => {
    setLoadingComments(true)
    setCommentError('')
    try {
      const result = await knowledgeService.listBookComments(targetBookId)
      setComments(result?.comments || [])
      setDiscussionAvailable(result?.available ?? true)
    } catch (loadError) {
      console.error('[knowledge] load book comments:', loadError)
      setCommentError('讨论加载失败，请稍后重试')
    } finally {
      setLoadingComments(false)
    }
  }, [])

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
    if (res.hasAccess || res.book?.is_free) {
      void loadBookComments(res.book.id)
    }

    try {
      const collectionSlug = getKnowledgeBookSource(res.book?.content)?.collectionSlug
      if (collectionSlug && res.collectionBooks?.length) {
        const collection = groupKnowledgeBooks(res.collectionBooks).find((item) => item.slug === collectionSlug)
        const siblings = (collection?.books || []).filter((item) => item.id !== res.book.id)
        setRelatedBooks(siblings)
      }
    } catch (listError) {
      console.error('[knowledge] load related books:', listError)
      setRelatedBooks([])
    } finally {
      setLoading(false)
    }
  }, [bookId, loadBookComments])

  useDidShow(() => {
    void loadBook()
  })

  const normalizedContent = normalizeBookContent(book?.content)
  const renderedMarkdown = normalizedContent.markdown
    ? renderBookMarkdown(normalizedContent.markdown)
    : ''
  const source = getKnowledgeBookSource(book?.content)
  const canReadContent = hasAccess || book?.is_free
  const childrenByParent = useMemo(() => {
    const map = new Map<string, KnowledgeBookDiscussionComment[]>()
    comments.forEach((comment) => {
      if (!comment.parentId) return
      const bucket = map.get(comment.parentId) || []
      bucket.push(comment)
      map.set(comment.parentId, bucket)
    })
    return map
  }, [comments])
  const rootComments = comments.filter(
    (comment) => !comment.parentId || !comments.some((candidate) => candidate.id === comment.parentId)
  )

  async function submitComment() {
    const body = commentDraft.trim()
    if (!body || commentSubmitting || !book?.id) return
    setCommentSubmitting(true)
    setCommentError('')
    try {
      const created = await knowledgeService.createBookComment({
        bookId: book.id,
        body,
        parentId: replyingTo?.id || null
      })
      if (created) {
        setComments((current) => [...current, created])
        setCommentDraft('')
        setReplyingTo(null)
      }
    } catch (submitError) {
      console.error('[knowledge] submit book comment:', submitError)
      setCommentError('发布失败，请稍后重试')
    } finally {
      setCommentSubmitting(false)
    }
  }

  async function deleteComment(comment: KnowledgeBookDiscussionComment) {
    if (!comment.isMine) return
    const result = await Taro.showModal({ title: '删除评论', content: '确定删除这条评论吗？' })
    if (!result.confirm) return
    try {
      if (await knowledgeService.deleteBookComment(comment.id)) {
        setComments((current) => current.filter((candidate) => candidate.id !== comment.id))
      }
    } catch (deleteError) {
      console.error('[knowledge] delete book comment:', deleteError)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  function renderComment(comment: KnowledgeBookDiscussionComment, depth = 0): React.ReactNode {
    const children = childrenByParent.get(comment.id) || []
    return (
      <View key={comment.id} className={`discussion-comment depth-${Math.min(depth, 2)}`}>
        <View className='discussion-comment-card'>
          <View className='discussion-avatar'>
            {comment.author.avatarUrl ? (
              <Image src={comment.author.avatarUrl} mode='aspectFill' />
            ) : (
              <Text>{comment.author.name.slice(0, 1)}</Text>
            )}
          </View>
          <View className='discussion-comment-main'>
            <View className='discussion-comment-head'>
              <Text className='discussion-author'>{comment.author.name}</Text>
              {comment.isMine ? <Text className='discussion-mine'>我</Text> : null}
              <Text className='discussion-time'>{formatDiscussionTime(comment.createdAt)}</Text>
            </View>
            <Text className='discussion-body'>{comment.body}</Text>
            <View className='discussion-actions'>
              <Text onClick={() => setReplyingTo(comment)}>回复</Text>
              {comment.isMine ? <Text className='delete' onClick={() => void deleteComment(comment)}>删除</Text> : null}
            </View>
          </View>
        </View>
        {children.length > 0 ? (
          <View className='discussion-children'>{children.map((child) => renderComment(child, depth + 1))}</View>
        ) : null}
      </View>
    )
  }

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

          {normalizedContent.readingGuide && (
            <View className='reading-card'>
              <View className='reading-card-head'>
                <Text className='content-section-title'>阅读导航</Text>
                {normalizedContent.readingGuide.estimatedMinutes ? (
                  <Text className='reading-time'>约 {normalizedContent.readingGuide.estimatedMinutes} 分钟</Text>
                ) : null}
              </View>
              {normalizedContent.readingGuide.suitableFor?.length ? (
                <View className='reading-block'>
                  <Text className='reading-label'>适合谁读</Text>
                  <View className='reading-tags'>
                    {normalizedContent.readingGuide.suitableFor.map((item) => <Text key={item}>{item}</Text>)}
                  </View>
                </View>
              ) : null}
              {normalizedContent.readingGuide.goals?.length ? (
                <View className='reading-block'>
                  <Text className='reading-label'>读完应带走什么</Text>
                  {normalizedContent.readingGuide.goals.map((item, index) => (
                    <Text key={item} className='reading-list-item'>{index + 1}. {item}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {normalizedContent.keyTakeaways.length > 0 && (
            <View className='rich-section'>
              <Text className='content-section-title'>本页要点</Text>
              <View className='takeaway-list'>
                {normalizedContent.keyTakeaways.map((item, index) => (
                  <View key={`${item}-${index}`} className='takeaway-card'>
                    <Text className='takeaway-index'>{index + 1}</Text>
                    <Text className='takeaway-text'>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {normalizedContent.mindMap?.data?.length ? (
            <View className='rich-section mind-map-section'>
              <Text className='content-section-title'>{normalizedContent.mindMap.title || '思维导图'}</Text>
              {normalizedContent.mindMap.description ? (
                <Text className='section-description'>{normalizedContent.mindMap.description}</Text>
              ) : null}
              <View className='mind-map-tree'>
                {normalizedContent.mindMap.data.map((node, index) => (
                  <MindMapNodeView key={node.id || `${node.title || 'root'}-${index}`} node={node} />
                ))}
              </View>
            </View>
          ) : null}

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

          {normalizedContent.discussionPrompts.length > 0 && (
            <View className='rich-section'>
              <Text className='content-section-title'>带着问题讨论</Text>
              <Text className='section-description'>先选一个问题写下自己的训练经历，再和其他读者交流。</Text>
              <View className='discussion-prompt-list'>
                {normalizedContent.discussionPrompts.map((item, index) => (
                  <View key={`${item}-${index}`} className='discussion-prompt-card'>
                    <Text className='discussion-index'>{index + 1}</Text>
                    <Text className='discussion-text'>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {normalizedContent.citations.length > 0 && (
            <View className='rich-section'>
              <Text className='content-section-title'>来源与版本</Text>
              <View className='citation-list'>
                {normalizedContent.citations.map((item, index) => (
                  <View
                    key={`${item.title || 'citation'}-${index}`}
                    className='citation-card'
                    onClick={() => item.url && Taro.setClipboardData({ data: item.url })}
                  >
                    <Text className='citation-title'>{item.title || '未命名来源'}</Text>
                    {item.note ? <Text className='citation-note'>{item.note}</Text> : null}
                    <Text className='citation-meta'>
                      {[item.license, item.accessedAt ? `访问于 ${item.accessedAt}` : '', item.url ? '点击复制链接' : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className='rich-section discussion-section'>
            <Text className='content-section-title'>读者讨论</Text>
            <Text className='section-description'>评论当前这篇总览或章节；回复会保留上下文。</Text>

            {!discussionAvailable ? (
              <View className='discussion-unavailable'>
                <Text>讨论区代码已就绪，待数据库迁移执行后开放发布。</Text>
              </View>
            ) : (
              <>
                {normalizedContent.discussionPrompts.length > 0 && (
                  <ScrollView scrollX className='discussion-prompt-scroll' showScrollbar={false}>
                    <View className='discussion-prompt-track'>
                      {normalizedContent.discussionPrompts.slice(0, 3).map((prompt) => (
                        <View
                          key={prompt}
                          className='discussion-prompt-chip'
                          onClick={() => setCommentDraft(`${prompt}\n\n`)}
                        >
                          <Text>{prompt}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {replyingTo ? (
                  <View className='discussion-replying'>
                    <Text>正在回复 {replyingTo.author.name}</Text>
                    <Text onClick={() => setReplyingTo(null)}>取消</Text>
                  </View>
                ) : null}

                <Textarea
                  className='discussion-textarea'
                  value={commentDraft}
                  maxlength={2000}
                  autoHeight
                  placeholder='写下你的理解、训练经历或问题…'
                  onInput={(event) => setCommentDraft(event.detail.value)}
                />
                <View className='discussion-submit-row'>
                  <Text className='discussion-counter'>{commentDraft.trim().length}/2000</Text>
                  <View
                    className={`discussion-submit ${!commentDraft.trim() || commentSubmitting ? 'disabled' : ''}`}
                    onClick={() => void submitComment()}
                  >
                    <Text>{commentSubmitting ? '发布中' : replyingTo ? '发布回复' : '发布评论'}</Text>
                  </View>
                </View>
              </>
            )}

            {commentError ? <Text className='discussion-error'>{commentError}</Text> : null}

            <View className='discussion-list'>
              {loadingComments ? (
                <View className='discussion-loading'><LoadingSpinner size={40} /></View>
              ) : rootComments.length > 0 ? (
                rootComments.map((comment) => renderComment(comment))
              ) : discussionAvailable ? (
                <Text className='discussion-empty'>还没有评论，欢迎留下第一条有内容的讨论。</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
