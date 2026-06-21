import { useEffect, useState } from 'react'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../api'
import { Page } from '../components/Page'
import { SectionCard } from '../components/SectionCard'
import { IconFont } from '../components/IconFont'
import { colors, radius, spacing } from '../theme'
import { HeroPanel, RowCard } from './AppHomeShared'
import type { MainTabParamList } from '../navigation/types'

type Props = BottomTabScreenProps<MainTabParamList, 'KnowledgeTab'>

const quickTags = ['平台期', '动作标准', '肩腕腰痛', '训练计划']
const focusTopics = [
  { title: '训练计划与平台期', subtitle: '负重引体、卧推、深蹲、力量举与体态纠正等高需求方向。', query: '平台期 训练计划 负重引体 卧推 深蹲' },
  { title: '动作标准与自查', subtitle: '引体、臂屈伸、深蹲、卧推、硬拉的检查表与常见代偿。', query: '动作标准 自查 引体 臂屈伸 深蹲 卧推 硬拉' },
  { title: '伤病避险与恢复', subtitle: '肩、腕、肘、腰背等高频不适的训练调整和避险边界。', query: '伤病 康复 疼痛 肩 手腕 肘 腰背' },
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
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const [planRes, bookRes, articleRes] = await Promise.allSettled([
          apiClient.request('/api/knowledge/training-plans', { method: 'GET', timeoutMs: 10000 }),
          apiClient.request('/api/knowledge/books', { method: 'GET', timeoutMs: 10000 }),
          apiClient.request('/api/knowledge/list-coach-contents', { method: 'POST', body: { limit: 6, offset: 0 }, timeoutMs: 10000 }),
        ])
        if (!alive) return
        if (planRes.status === 'fulfilled') setPlans(pickArray((planRes.value as any).data, ['plans', 'items', 'data']).slice(0, 8))
        if (bookRes.status === 'fulfilled') setBooks(pickArray((bookRes.value as any).data, ['books', 'items', 'data']).slice(0, 4))
        if (articleRes.status === 'fulfilled') setArticles(pickArray((articleRes.value as any).data, ['items', 'contents', 'data']).slice(0, 6))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [])

  async function doSearch(nextKeyword = keyword) {
    const q = nextKeyword.trim()
    if (!q) return
    setKeyword(q)
    setSearching(true)
    setSearched(true)
    try {
      const res = await apiClient.request(`/api/knowledge/search?q=${encodeURIComponent(q)}`, { method: 'GET', timeoutMs: 10000 })
      setResults(pickArray((res as any).data, ['results', 'items', 'data']))
    } finally {
      setSearching(false)
    }
  }

  return (
    <Page>
      <HeroPanel title="知识库" subtitle="训练计划、动作标准、伤病避险与书籍资料。" icon="icon-knowledge" />

      <SectionCard title="知识库仍在建设中" description="先开放最核心的训练与学习资料。疼痛、麻木、急性损伤或长期不适不能用内容替代医疗诊断。" />

      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput value={keyword} onChangeText={setKeyword} placeholder="搜索动作、计划、伤病或书籍..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => doSearch()} />
        <Pressable onPress={() => doSearch()} style={styles.searchButton}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {quickTags.map((tag) => (
          <Pressable key={tag} onPress={() => doSearch(tag)} style={styles.chip}><Text style={styles.chipText}>{tag}</Text></Pressable>
        ))}
      </ScrollView>

      {searched ? (
        <SectionCard title="搜索结果" description={searching ? '搜索中...' : `关键词：${keyword}`}>
          {searching ? <ActivityIndicator color={colors.brand} /> : null}
          {!searching && results.length === 0 ? <Text style={styles.empty}>暂无匹配内容。</Text> : null}
          {results.slice(0, 8).map((item) => <RowCard key={String(item.id || item.title)} title={item.title || item.name || '知识内容'} subtitle={item.description || item.summary || '点击查看内容'} icon="icon-knowledge" onPress={() => rootNav?.navigate('KnowledgeSearch', { id: item.id })} />)}
        </SectionCard>
      ) : null}

      <SectionCard title="先看最常见的问题" description="精选专题与小程序知识库保持一致。">
        {focusTopics.map((topic, index) => <RowCard key={topic.title} title={`${index + 1}. ${topic.title}`} subtitle={topic.subtitle} icon="icon-knowledge" onPress={() => doSearch(topic.query)} />)}
      </SectionCard>

      <SectionCard title="重点训练计划" description="优先展示平台期、专项力量和体态纠正方向，便于直接复制使用。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {plans.length === 0 && !loading ? <Text style={styles.empty}>暂无训练计划。</Text> : null}
        {plans.slice(0, 6).map((plan) => <RowCard key={String(plan.id || plan.slug || plan.name)} title={plan.name || plan.title || '训练计划'} subtitle={`${plan.weeks || '-'}周 · ${plan.daysPerWeek || plan.days_per_week || '-'}天/周 · ${plan.specialtyLabel || plan.goal || plan.sport || '训练'}`} icon="icon-a-Trainingplan" onPress={() => rootNav?.navigate('KnowledgePlanDetail', { id: plan.slug || plan.id })} />)}
      </SectionCard>

      <SectionCard title="书籍笔记" description="深度资料保留在这里，适合需要理解原理时阅读。">
        {books.length === 0 && !loading ? <Text style={styles.empty}>暂无书籍笔记。</Text> : null}
        {books.map((book) => <RowCard key={String(book.id || book.slug || book.title)} title={book.title || book.name || '书籍笔记'} subtitle={book.summary || book.description || '进入阅读'} icon="icon-knowledge" onPress={() => rootNav?.navigate('KnowledgeBookDetail', { id: book.id || book.slug })} />)}
      </SectionCard>

      <SectionCard title="教练专栏" description="对应小程序教练专栏广场，按订阅权限展示可读内容。">
        {articles.length === 0 && !loading ? <Text style={styles.empty}>暂无教练专栏内容。</Text> : null}
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
    </Page>
  )
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchButton: { minHeight: 38, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800' },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textSecondary, fontWeight: '700' },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
})
