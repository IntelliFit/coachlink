import { useEffect, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../api'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { NativeAudioPlayer } from '../../components/NativeMedia'
import { colors, radius, spacing } from '../../theme'
import { HeroPanel, RowCard } from '../AppHomeShared'
import type { RootStackParamList } from '../../navigation/types'
import { getBookSource, normalizeBookContent, pickArray } from './knowledgeHelpers'

type Props = NativeStackScreenProps<RootStackParamList, 'KnowledgeBookDetail'>

export function KnowledgeBookDetailScreen({ navigation, route }: Props) {
  const bookId = route.params?.id || ''
  const [book, setBook] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [relatedBooks, setRelatedBooks] = useState<any[]>([])

  async function loadBook() {
    if (!bookId) {
      setError('缺少书籍 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setRelatedBooks([])
    try {
      const payload = await apiClient.request<any>(`/api/knowledge/books/${encodeURIComponent(bookId)}`, { method: 'GET', timeoutMs: 10000 })
      setBook(payload?.book || null)
      setHasAccess(Boolean(payload?.hasAccess))
      await loadRelated(payload?.book)
    } catch (err) {
      setBook(null)
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function loadRelated(currentBook: any) {
    const collectionSlug = getBookSource(currentBook?.content)?.collectionSlug
    if (!collectionSlug) return
    try {
      const payload = await apiClient.request<any>('/api/knowledge/books?is_published=true', { method: 'GET', timeoutMs: 10000 })
      const books = pickArray(payload, ['books', 'items', 'data'])
      const siblings = books.filter((item: any) => {
        const source = getBookSource(item?.content)
        return source?.collectionSlug === collectionSlug && item.id !== currentBook?.id
      })
      setRelatedBooks(siblings.slice(0, 8))
    } catch {
      setRelatedBooks([])
    }
  }

  useEffect(() => {
    void loadBook()
  }, [bookId])

  if (loading) {
    return (
      <Page>
        <HeroPanel title="书籍详情" subtitle="正在加载书籍笔记。" icon="icon-knowledge" />
        <ActivityIndicator color={colors.brand} />
      </Page>
    )
  }

  if (error && !book) {
    const needsLogin = /用户未登录|Unauthorized|401/i.test(error)
    return (
      <Page>
        <HeroPanel title={needsLogin ? '登录后可读' : '书籍详情'} subtitle={needsLogin ? '这部分书籍内容需要登录后检查阅读权限。' : error} icon="icon-knowledge" />
        <View style={styles.footerActions}>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
          {needsLogin ? <Pressable onPress={() => navigation.navigate('Login')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>去登录</Text></Pressable> : null}
        </View>
      </Page>
    )
  }

  if (!book) {
    return (
      <Page>
        <HeroPanel title="书籍不存在" subtitle="这本书可能已经下架。" icon="icon-knowledge" />
        <Pressable onPress={() => navigation.goBack()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>返回</Text></Pressable>
      </Page>
    )
  }

  const normalized = normalizeBookContent(book.content)
  const source = getBookSource(book.content)
  const canReadContent = hasAccess || book.is_free

  if (!canReadContent) {
    return (
      <Page>
        <HeroPanel title={book.title || '书籍详情'} subtitle="这本书需要订阅知识库会员后才能查看完整内容。" icon="icon-knowledge" />
        <SectionCard title="订阅后可读" description={book.summary || '返回知识库继续浏览免费内容，或登录后检查订阅权限。'} />
        <View style={styles.footerActions}>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
          <Pressable onPress={() => navigation.navigate('Membership')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>查看会员</Text></Pressable>
        </View>
      </Page>
    )
  }

  return (
    <Page>
      <HeroPanel title={book.title || '书籍详情'} subtitle={book.summary || '深度资料与训练原理笔记。'} icon="icon-knowledge" />

      <SectionCard title="书籍信息">
        <View style={styles.bookTop}>
          {book.cover_image ? <Image source={{ uri: book.cover_image }} style={styles.cover} resizeMode="cover" /> : <View style={styles.coverPlaceholder}><Text style={styles.coverText}>书</Text></View>}
          <View style={styles.bookMain}>
            <Text style={styles.bookTitle}>{book.title || '未命名书籍'}</Text>
            {book.author ? <Text style={styles.bookMeta}>作者：{book.author}</Text> : null}
            <View style={styles.badges}>
              <Text style={[styles.badge, book.is_free ? styles.freeBadge : styles.paidBadge]}>{book.is_free ? '免费内容' : '付费内容'}</Text>
              {source?.noteType === 'overview' ? <Text style={styles.badge}>专题总览</Text> : null}
              {source?.noteType === 'chapter' ? <Text style={styles.badge}>{source.chapterTitle || '专题分篇'}</Text> : null}
            </View>
          </View>
        </View>
      </SectionCard>

      {normalized.disclaimer ? <SectionCard title="解读型笔记" description={normalized.disclaimer} /> : null}

      <SectionCard title="内容详情">
        {normalized.text ? <Text style={styles.contentText}>{normalized.text}</Text> : <Text style={styles.empty}>{book.summary || '暂无详细内容'}</Text>}
      </SectionCard>

      {book.audio_url ? (
        <SectionCard title="AI 讲解音频" description="支持播放、暂停和前后 15 秒定位；离开页面后播放器会自动释放。">
          <NativeAudioPlayer url={book.audio_url} title={book.title || '书籍讲解'} />
        </SectionCard>
      ) : null}

      {relatedBooks.length > 0 ? (
        <SectionCard title="同书专题">
          {relatedBooks.map((item) => <RowCard key={String(item.id)} title={item.title || '书籍笔记'} subtitle={item.summary || '点击继续阅读'} icon="icon-knowledge" onPress={() => navigation.push('KnowledgeBookDetail', { id: item.id })} />)}
        </SectionCard>
      ) : null}

      {normalized.prompts.length > 0 ? (
        <SectionCard title="配图提示词">
          {normalized.prompts.map((item: { title?: string; intent?: string; prompt?: string }, index: number) => (
            <View key={`${item?.title || 'prompt'}-${index}`} style={styles.promptCard}>
              <Text style={styles.promptTitle}>{item?.title || `配图提示词 ${index + 1}`}</Text>
              {item?.intent ? <Text style={styles.promptIntent}>用途：{item.intent}</Text> : null}
              <Text style={styles.promptBody}>{item?.prompt || '暂无提示词'}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
    </Page>
  )
}

const styles = StyleSheet.create({
  bookTop: { flexDirection: 'row', gap: spacing.sm },
  cover: { width: 96, height: 128, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  coverPlaceholder: { width: 96, height: 128, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  coverText: { color: colors.textMuted, fontSize: 24, fontWeight: '900' },
  bookMain: { flex: 1, gap: spacing.xs },
  bookTitle: { color: colors.text, fontSize: 18, fontWeight: '900', lineHeight: 24 },
  bookMeta: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '800' },
  freeBadge: { color: colors.success, backgroundColor: '#EAF6EE' },
  paidBadge: { color: colors.warning, backgroundColor: '#FFF3D8' },
  contentText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  empty: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  promptCard: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceMuted },
  promptTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  promptIntent: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  promptBody: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 4 },
  footerActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  primaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
})
