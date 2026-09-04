import { useEffect, useState } from 'react'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../api'
import { Page } from '../components/Page'
import { SectionCard } from '../components/SectionCard'
import { IconFont } from '../components/IconFont'
import { colors, radius, spacing } from '../theme'
import { HeroPanel, RowCard } from './AppHomeShared'
import type { MainTabParamList } from '../navigation/types'
import { useAuth } from '../providers/AuthProvider'
import { knowledgeHomeCacheScope, readKnowledgeHomeCache, writeKnowledgeHomeCache } from './knowledge/knowledgeHomeCache'

type Props = BottomTabScreenProps<MainTabParamList, 'KnowledgeTab'>

const quickTags = ['平台期', '动作标准', '肩腕腰痛', '训练计划']
const focusTopics = [
  { title: '训练计划与平台期', subtitle: '负重引体、卧推、深蹲、力量举与体态纠正等高需求方向。', query: '平台期 训练计划 负重引体 卧推 深蹲' },
  { title: '动作标准与自查', subtitle: '引体、臂屈伸、深蹲、卧推、硬拉的检查表与常见代偿。', query: '动作标准 自查 引体 臂屈伸 深蹲 卧推 硬拉' },
  { title: '伤病避险与恢复', subtitle: '肩、腕、肘、腰背等高频不适的训练调整和避险边界。', query: '伤病 康复 疼痛 肩 手腕 肘 腰背' },
]

const offlinePlanReferences = [
  { id: 'boostcamp-08182a97-0789-4387-aa76-7f2b9f4e8739', slug: 'reference-boostcamp-phul-4-day-split', name: 'PHUL 4 日力量增肌', description: '兼顾力量与肌肥大的 12 周公开计划来源索引。', sport: '力量与体能训练', goal: '增肌 / 力量', level: 'intermediate', weeks: 12, daysPerWeek: 4, equipment: ['综合健身房'], tags: ['力量', '增肌'], suitableFor: '有基础训练者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 48, entryKind: 'reference', canCopy: false, author: 'Brandon Campbell', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/brandon-campbell/phul-4-day-split' },
  { id: 'boostcamp-b51de821-4ee1-4929-902b-acfd4925276b', slug: 'reference-boostcamp-gzcl-program-gzclp', name: 'GZCLP 线性进阶', description: '适合入门到中阶力量训练者的公开计划来源索引。', sport: '力量与体能训练', goal: '力量 / 增肌', level: 'beginner', weeks: 12, daysPerWeek: 4, equipment: ['综合健身房'], tags: ['力量', '入门'], suitableFor: '入门训练者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 48, entryKind: 'reference', canCopy: false, author: 'Cody Lefever', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/cody-lefever/gzcl-program-gzclp' },
  { id: 'boostcamp-f514b9f5-8546-4fb8-8c77-88b7d8bb323a', slug: 'reference-boostcamp-reddit-ppl', name: 'Reddit PPL 推拉腿', description: '每周 6 天推、拉、腿拆分训练的公开计划来源索引。', sport: '力量与体能训练', goal: '增肌 / 力量', level: 'intermediate', weeks: 12, daysPerWeek: 6, equipment: ['综合健身房'], tags: ['推拉腿', '增肌'], suitableFor: '有稳定训练习惯者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 72, entryKind: 'reference', canCopy: false, author: 'r/Fitness', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/r-fitness/reddit-ppl' },
  { id: 'boostcamp-f56fbceb-1edc-4593-aa08-0189b5759630', slug: 'reference-boostcamp-nsuns-linear-progression', name: 'nSuns 5/3/1', description: '高频复合动作线性进阶的公开计划来源索引。', sport: '力量与体能训练', goal: '力量 / 增肌', level: 'intermediate', weeks: 8, daysPerWeek: 6, equipment: ['综合健身房'], tags: ['力量', '高频'], suitableFor: '有基础训练者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 48, entryKind: 'reference', canCopy: false, author: 'r/Fitness', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/r-fitness/nsuns-linear-progression' },
  { id: 'boostcamp-491bf237-3d41-42fd-ace7-1bb7748d83ed', slug: 'reference-boostcamp-bullmastiff', name: 'Bullmastiff 力量周期', description: '强调主项容量与阶段进阶的 19 周公开计划来源索引。', sport: '力量与体能训练', goal: '力量 / 增肌', level: 'intermediate', weeks: 19, daysPerWeek: 4, equipment: ['综合健身房'], tags: ['力量', '周期'], suitableFor: '中阶训练者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 76, entryKind: 'reference', canCopy: false, author: 'Alex Bromley', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/alex-bromley/bullmastiff' },
  { id: 'boostcamp-db2febb3-b1b1-4e39-9c90-7d22dd099471', slug: 'reference-boostcamp-phat', name: 'PHAT 力量肌肥大', description: '力量日与肌肥大日结合的公开计划来源索引。', sport: '力量与体能训练', goal: '增肌 / 力量', level: 'advanced', weeks: 4, daysPerWeek: 5, equipment: ['综合健身房'], tags: ['力量', '肌肥大'], suitableFor: '进阶训练者', notes: ['本条目仅提供公开来源索引，不复制第三方完整处方。'], specialtyLabel: '力量与增肌', trainingDayCount: 20, entryKind: 'reference', canCopy: false, author: 'Layne Norton', sourceName: 'Boostcamp', sourceUrl: 'https://www.boostcamp.app/coaches/layne-norton/phat' },
]
function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export function KnowledgeScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  const { isAuthenticated, isGuest, user } = useAuth()
  const hasPrivateAccess = isAuthenticated && !isGuest
  const cacheScope = knowledgeHomeCacheScope(hasPrivateAccess ? user?.id : null)
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchError, setSearchError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    async function load() {
      const cached = await readKnowledgeHomeCache(cacheScope)
      if (!alive) return
      if (cached) {
        setPlans(cached.plans)
        setBooks(hasPrivateAccess ? cached.books : [])
        setArticles(hasPrivateAccess ? cached.articles : [])
        setLoading(false)
      } else {
        setLoading(true)
      }

      const [planRes, bookRes, articleRes] = await Promise.allSettled([
        apiClient.request('/api/knowledge/training-plans?limit=8', { method: 'GET', timeoutMs: 10000 }),
        hasPrivateAccess
          ? apiClient.request('/api/knowledge/books?is_published=true', { method: 'GET', timeoutMs: 10000 })
          : Promise.resolve(null),
        hasPrivateAccess
          ? apiClient.request('/api/knowledge/list-coach-contents', { method: 'POST', body: { limit: 6, offset: 0 }, timeoutMs: 10000 })
          : Promise.resolve(null),
      ])
      if (!alive) return

      let nextPlans = cached?.plans || []
      let nextBooks = hasPrivateAccess ? cached?.books || [] : []
      let nextArticles = hasPrivateAccess ? cached?.articles || [] : []
      const failed: string[] = []

      if (planRes.status === 'fulfilled') nextPlans = pickArray(planRes.value, ['plans', 'items', 'data']).slice(0, 8)
      else if (nextPlans.length === 0) {
        nextPlans = offlinePlanReferences
        failed.push('在线计划（当前展示离线参考）')
      } else {
        failed.push('训练计划')
      }
      if (hasPrivateAccess) {
        if (bookRes.status === 'fulfilled') nextBooks = pickArray(bookRes.value, ['books', 'items', 'data']).slice(0, 4)
        else failed.push('书籍笔记')
        if (articleRes.status === 'fulfilled') nextArticles = pickArray(articleRes.value, ['items', 'contents', 'data']).slice(0, 6)
        else failed.push('教练专栏')
      }

      setPlans(nextPlans)
      setBooks(nextBooks)
      setArticles(nextArticles)
      setLoadError(failed.length > 0 ? `${failed.join('、')}暂时未能更新，已保留可用内容。` : '')
      setLoading(false)

      const hasFreshData = planRes.status === 'fulfilled' || nextPlans.length > 0
        || (hasPrivateAccess && (bookRes.status === 'fulfilled' || articleRes.status === 'fulfilled'))
      if (hasFreshData) {
        await writeKnowledgeHomeCache(cacheScope, {
          plans: nextPlans,
          books: nextBooks,
          articles: nextArticles,
        }).catch(() => undefined)
      }
    }
    void load()
    return () => { alive = false }
  }, [cacheScope, hasPrivateAccess, reloadKey])

  async function doSearch(nextKeyword = keyword) {
    const q = nextKeyword.trim()
    if (!q) return
    setKeyword(q)
    if (!isAuthenticated || isGuest) {
      Alert.alert('请先登录', '登录后可以搜索完整知识库并查看订阅内容。', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => rootNav?.navigate('Login') },
      ])
      return
    }
    setSearchError('')
    setSearching(true)
    setSearched(true)
    try {
      const res = await apiClient.request(`/api/knowledge/search?q=${encodeURIComponent(q)}`, { method: 'GET', timeoutMs: 10000 })
      setResults(pickArray(res, ['results', 'items', 'data']))
    } catch (error: any) {
      setSearchError(error?.message || '搜索失败，请稍后重试。')
    } finally {
      setSearching(false)
    }
  }

  return (
    <Page>
      <HeroPanel title="知识库" subtitle="训练计划、动作标准、伤病避险与书籍资料。" icon="icon-knowledge" />

      <SectionCard title="训练知识与计划" description="按问题搜索动作标准、训练计划与恢复资料。疼痛、麻木、急性损伤或长期不适不能用内容替代医疗诊断。" />

      {loadError ? (
        <View style={styles.loadNotice} accessibilityLiveRegion="polite">
          <Text style={styles.loadNoticeText}>{loadError}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="重新加载知识库" onPress={() => setReloadKey((value) => value + 1)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>重新加载</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput accessibilityLabel="搜索知识库" value={keyword} onChangeText={setKeyword} placeholder="搜索动作、计划、伤病或书籍..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => doSearch()} />
        <Pressable accessibilityRole="button" accessibilityLabel="搜索知识库" accessibilityState={{ disabled: searching, busy: searching }} disabled={searching} onPress={() => doSearch()} style={[styles.searchButton, searching && styles.disabled]}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {quickTags.map((tag) => (
          <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`搜索${tag}`} accessibilityState={{ disabled: searching }} disabled={searching} onPress={() => doSearch(tag)} style={[styles.chip, searching && styles.disabled]}><Text style={styles.chipText}>{tag}</Text></Pressable>
        ))}
      </ScrollView>

      {searched ? (
        <SectionCard title="搜索结果" description={searching ? '搜索中...' : searchError || `关键词：${keyword}`}>
          {searching ? <ActivityIndicator color={colors.brand} /> : null}
          {!searching && results.length === 0 ? <Text style={styles.empty}>{searchError || '暂无匹配内容。'}</Text> : null}
          {results.slice(0, 8).map((item) => <RowCard key={String(item.id || item.title)} title={item.title || item.name || '知识内容'} subtitle={item.description || item.summary || '点击查看内容'} icon="icon-knowledge" onPress={() => rootNav?.navigate('KnowledgeSearch', { id: item.id })} />)}
        </SectionCard>
      ) : null}

      <SectionCard title="先看最常见的问题" description="精选专题与小程序知识库保持一致。">
        {focusTopics.map((topic, index) => <RowCard key={topic.title} title={`${index + 1}. ${topic.title}`} subtitle={topic.subtitle} icon="icon-knowledge" onPress={() => doSearch(topic.query)} />)}
      </SectionCard>

      <SectionCard title="重点训练计划" description="优先展示平台期、专项力量和体态纠正方向，便于直接复制使用。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {plans.length === 0 && !loading && !loadError ? <Text style={styles.empty}>暂无训练计划。</Text> : null}
        {plans.slice(0, 6).map((plan) => <RowCard key={String(plan.id || plan.slug || plan.name)} title={plan.name || plan.title || '训练计划'} subtitle={`${plan.weeks || '-'}周 · ${plan.daysPerWeek || plan.days_per_week || '-'}天/周 · ${plan.specialtyLabel || plan.goal || plan.sport || '训练'}`} icon="icon-a-Trainingplan" onPress={() => rootNav?.navigate('KnowledgePlanDetail', { id: plan.slug || plan.id, fallback: plan })} />)}
      </SectionCard>

      {!hasPrivateAccess ? (
        <SectionCard title="登录后继续" description="书籍笔记、教练专栏和完整知识搜索需要登录后检查阅读权限。">
          <Pressable accessibilityRole="button" accessibilityLabel="登录后查看完整知识库" onPress={() => rootNav?.navigate('Login')} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>去登录</Text>
          </Pressable>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="书籍笔记" description="深度资料保留在这里，适合需要理解原理时阅读。">
            {books.length === 0 && !loading && !loadError ? <Text style={styles.empty}>暂无书籍笔记。</Text> : null}
            {books.map((book) => <RowCard key={String(book.id || book.slug || book.title)} title={book.title || book.name || '书籍笔记'} subtitle={book.summary || book.description || '进入阅读'} icon="icon-knowledge" onPress={() => rootNav?.navigate('KnowledgeBookDetail', { id: book.id || book.slug })} />)}
          </SectionCard>

          <SectionCard title="教练专栏" description="对应小程序教练专栏广场，按订阅权限展示可读内容。">
            {articles.length === 0 && !loading && !loadError ? <Text style={styles.empty}>暂无教练专栏内容。</Text> : null}
            {articles.map((item) => {
              const content = item.content || item
              const coach = item.coach || content.coach
              const locked = item.canView === false || content.is_locked
              return (
                <RowCard
                  key={String(content.id || content.title)}
                  title={content.title || '教练文章'}
                  subtitle={`${coach?.name || '教练'}${locked ? ' · 订阅后可见' : ''}`}
                  icon={locked ? 'icon-vips' : 'icon-knowledge'}
                  onPress={() => rootNav?.navigate('CoachContentDetail', { id: content.id })}
                />
              )
            })}
          </SectionCard>
        </>
      )}
    </Page>
  )
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800' },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textSecondary, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  loadNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  loadNoticeText: { flex: 1, color: '#9A3412', fontSize: 13, lineHeight: 20 },
  retryButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDBA74' },
  retryButtonText: { color: '#9A3412', fontSize: 13, fontWeight: '900' },
  loginButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
})
