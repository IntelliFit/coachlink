import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { EmptyState, LoadingState, ScreenShell, SolidButton, errorMessage, type RootNav } from '../me/MeShared'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from './knowledgeBooks'
import { getBeijingDateParts } from '@coachlink/core/src/beijingTime'
import { InlineAvatar } from '../me/MeShared'
import { PLAN_LEVEL_LABELS, pickArray, stripHtmlToText, type PublicTrainingPlanLevel } from './knowledgeHelpers'

const PLAN_PAGE_SIZE = 30
const LEVELS: Array<{ value: 'all' | PublicTrainingPlanLevel; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高阶' },
]

/** 全部训练计划，对应小程序 content/knowledge/plans。 */
export function KnowledgePlansScreen() {
  const navigation = useNavigation<RootNav>()
  const [plans, setPlans] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [level, setLevel] = useState<'all' | PublicTrainingPlanLevel>('all')
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  const load = useCallback(async (offset: number) => {
    // 切换筛选后，旧筛选晚到的结果和翻页都不能写进当前列表
    const requestId = ++requestIdRef.current
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const params = [`level=${encodeURIComponent(level)}`, `limit=${PLAN_PAGE_SIZE}`, `offset=${offset}`]
      if (activeQuery) params.push(`q=${encodeURIComponent(activeQuery)}`)
      const data = await apiClient.request<any>(`/api/knowledge/training-plans?${params.join('&')}`, { method: 'GET', timeoutMs: 12000 })
      if (requestId !== requestIdRef.current) return
      const rows = pickArray(data, ['plans'])
      setPlans((current) => (offset === 0 ? rows : [...current, ...rows]))
      setTotal(Number(data?.total ?? data?.data?.total ?? rows.length))
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      if (offset === 0) setPlans([])
      setError(errorMessage(loadError, '加载失败'))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [activeQuery, level])

  useEffect(() => {
    void load(0)
  }, [load])

  async function openPlan(plan: any) {
    if (plan.entryKind === 'reference' && plan.sourceUrl) {
      Alert.alert('来源计划', `该条目由 ${plan.author || plan.sourceName || '原作者'} 发布，当前仅保留来源索引，尚未复制第三方完整处方。`, [
        { text: '取消', style: 'cancel' },
        { text: '复制链接', onPress: () => void Clipboard.setStringAsync(String(plan.sourceUrl)).then(() => Alert.alert('链接已复制')) },
      ])
      return
    }
    navigation.navigate('KnowledgePlanDetail', { id: plan.slug || plan.id, fallback: plan })
  }

  return (
    <ScreenShell title="训练计划" subtitle={`共 ${total} 套已发布计划，按目标和水平挑选。`} onBack={() => navigation.goBack()}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <IconFont name="icon-search" color={colors.textMuted} size={18} />
          <TextInput accessibilityLabel="搜索训练计划" value={query} onChangeText={setQuery} onSubmitEditing={() => setActiveQuery(query.trim())} returnKeyType="search" placeholder="搜索名称、运动或目标" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="搜索" onPress={() => setActiveQuery(query.trim())} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>搜索</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {LEVELS.map((option) => {
          const active = level === option.value
          return (
            <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setLevel(option.value)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? <LoadingState title="正在加载训练计划" /> : null}
      {!loading && error && plans.length === 0 ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && plans.length === 0 ? <EmptyState title="没有找到匹配的训练计划。" icon="icon-a-Trainingplan" /> : null}
      {!loading ? plans.map((plan) => (
        <Pressable key={String(plan.id)} accessibilityRole="button" accessibilityLabel={`查看计划：${plan.name}`} onPress={() => void openPlan(plan)} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.specialty} numberOfLines={1}>{plan.specialtyLabel || plan.goal || '训练计划'}</Text>
            {plan.level ? <Text style={styles.level}>{PLAN_LEVEL_LABELS[plan.level as PublicTrainingPlanLevel] || plan.level}</Text> : null}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{plan.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{plan.description || '查看完整训练安排与适用人群'}</Text>
          {plan.entryKind === 'reference' ? <Text style={styles.source} numberOfLines={1}>来源索引 · {plan.author || plan.sourceName || '原作者'}</Text> : null}
          <Text style={styles.meta}>{plan.weeks ?? '-'}周 · {plan.daysPerWeek ?? '-'}天/周{plan.sport ? ` · ${plan.sport}` : ''}</Text>
        </Pressable>
      )) : null}
      {!loading && plans.length < total ? (
        <SolidButton label={loadingMore ? '加载中…' : '加载更多'} variant="secondary" loading={loadingMore} onPress={() => void load(plans.length)} />
      ) : null}
    </ScreenShell>
  )
}

/** 全部书籍笔记，按整本书聚合，对应小程序 content/knowledge/books。 */
export function KnowledgeBooksScreen() {
  const navigation = useNavigation<RootNav>()
  const [collections, setCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    apiClient.request<any>('/api/knowledge/list-books', { method: 'POST', body: { is_published: true, page: 0, limit: 1000 }, timeoutMs: 15000 })
      .then((data) => { if (alive) setCollections(groupKnowledgeBooks(pickArray(data, ['books']))) })
      .catch(() => { if (alive) setError('书籍列表加载失败，请稍后重试') })
      .finally(() => { if (alive) setLoading(false) })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return collections
    return collections.filter((collection) => [collection.displayTitle, collection.summary, collection.representativeBook.author || '']
      .join(' ')
      .toLowerCase()
      .includes(query))
  }, [collections, keyword])

  return (
    <ScreenShell title="全部书籍笔记" subtitle="按整本书聚合总览、章节、思维导图和讨论。" onBack={() => navigation.goBack()}>
      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput accessibilityLabel="搜索书籍" value={keyword} onChangeText={setKeyword} placeholder="搜索书名、作者或主题" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
      </View>
      <Text style={styles.count}>{loading ? '正在整理书架' : `共 ${filtered.length} 本`}</Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState title="没有找到匹配的书籍。" icon="icon-knowledge" /> : null}
      {!loading && !error ? filtered.map((collection) => (
        <Pressable key={collection.slug} accessibilityRole="button" accessibilityLabel={`阅读：${collection.displayTitle}`} onPress={() => navigation.navigate('KnowledgeBookDetail', { id: collection.representativeBook.id })} style={styles.bookCard}>
          {collection.representativeBook.cover_image ? (
            <Image source={{ uri: collection.representativeBook.cover_image }} style={styles.cover} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}><Text style={styles.coverText}>书</Text></View>
          )}
          <View style={styles.bookMain}>
            <Text style={styles.cardTitle} numberOfLines={2}>{collection.displayTitle}</Text>
            {collection.representativeBook.author ? <Text style={styles.meta} numberOfLines={1}>{collection.representativeBook.author}</Text> : null}
            <Text style={styles.cardDesc} numberOfLines={2}>{collection.summary}</Text>
            <Text style={styles.meta}>{collection.chapterCount > 0 ? `${collection.chapterCount} 篇章节` : '单篇解读'}</Text>
          </View>
          <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
        </Pressable>
      )) : null}
    </ScreenShell>
  )
}

/** 精选好文：平台编辑与教练发布的公开内容，对应小程序 content/articles。 */
export function KnowledgeArticlesScreen() {
  const navigation = useNavigation<RootNav>()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    apiClient.request<any>('/api/public/articles/list?limit=30&offset=0', { method: 'GET', timeoutMs: 12000 })
      .then((data) => {
        if (!alive) return
        const rows = pickArray(data, ['items'])
          .map((item: any) => ({
            id: String(item?.id || ''),
            coachName: String(item?.coachName || '教练'),
            coachAvatarUrl: item?.coachAvatarUrl || null,
            title: String(item?.title || '未命名内容'),
            summary: stripHtmlToText(String(item?.summary || '')).slice(0, 96) || '点击查看详情',
            free: !item?.priceCents && !item?.requiredTier,
            publishedAt: String(item?.publishedAt || ''),
          }))
          .filter((item) => item.id)
          .sort((a, b) => (new Date(b.publishedAt).getTime() || 0) - (new Date(a.publishedAt).getTime() || 0))
        setArticles(rows)
      })
      .catch((loadError) => { if (alive) setError(errorMessage(loadError, '加载失败')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ScreenShell title="精选好文" subtitle={`平台编辑与教练发布的训练内容${loading ? '' : ` · 共 ${articles.length} 篇`}`} onBack={() => navigation.goBack()}>
      {loading ? <LoadingState title="正在加载文章" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && articles.length === 0 ? <EmptyState title="暂无文章" desc="教练在「内容管理」发布后，这里会自动展示。" icon="icon-knowledge" /> : null}
      {!loading ? articles.map((article) => (
        <Pressable key={article.id} accessibilityRole="button" accessibilityLabel={`阅读：${article.title}`} onPress={() => navigation.navigate('CoachContentDetail', { id: article.id })} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.author}>
              <InlineAvatar uri={article.coachAvatarUrl} label={article.coachName} size={32} />
              <Text style={styles.authorName} numberOfLines={1}>{article.coachName}</Text>
            </View>
            <Text style={[styles.badge, article.free ? styles.badgeFree : null]}>{article.free ? '免费' : '订阅内容'}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{article.summary}</Text>
          <View style={styles.cardTop}>
            <Text style={styles.meta}>{formatArticleDate(article.publishedAt)}</Text>
            <Text style={styles.readMore}>阅读全文</Text>
          </View>
        </Pressable>
      )) : null}
    </ScreenShell>
  )
}

function formatArticleDate(value: string) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return ''
  const parts = getBeijingDateParts(value)
  return `${parts.year}/${parts.month}/${parts.day}`
}

const styles = StyleSheet.create({
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  authorName: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  badge: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.textTertiary, backgroundColor: colors.surfaceMuted, fontSize: 11 },
  badgeFree: { color: colors.success, backgroundColor: colors.successSoft },
  readMore: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchBox: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: 14 },
  searchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  specialty: { flex: 1, color: colors.brand, fontSize: 12, fontWeight: '600' },
  level: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 11 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  source: { color: colors.textTertiary, fontSize: 12 },
  meta: { color: colors.textTertiary, fontSize: 12 },
  count: { color: colors.textSecondary, fontSize: 13 },
  bookCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cover: { width: 64, height: 88, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverText: { color: colors.textTertiary, fontSize: 18, fontWeight: '700' },
  bookMain: { flex: 1, gap: 4 },
})
