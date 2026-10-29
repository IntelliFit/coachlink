import { useEffect, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../../api'
import { useAuth } from '../../providers/AuthProvider'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { NativeVideoPlayer } from '../../components/NativeMedia'
import { colors, radius, spacing } from '../../theme'
import { HeroPanel, RowCard } from '../AppHomeShared'
import type { RootStackParamList } from '../../navigation/types'
import { normalizeContentBody, pickArray } from './knowledgeHelpers'

type Props = NativeStackScreenProps<RootStackParamList, 'KnowledgeSearch'>

type SearchResult = {
  id: string
  title?: string
  description?: string | null
  node_type?: string
  body_region?: string[] | null
  is_free?: boolean
}

function getVideoUrl(node: any) {
  const content = node?.content
  if (content && typeof content === 'object' && typeof content.video_url === 'string') return content.video_url
  return ''
}

export function KnowledgeSearchScreen({ navigation, route }: Props) {
  const { isAuthenticated } = useAuth()
  const initialQuery = route.params?.query || ''
  const initialId = route.params?.id || ''
  const [keyword, setKeyword] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [node, setNode] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadNode(id: string) {
    if (!id) return
    setLoading(true)
    setError('')
    setNode(null)
    setHasAccess(false)
    setArticles([])
    try {
      const payload = await apiClient.request<any>(`/api/knowledge/nodes/${encodeURIComponent(id)}`, { method: 'GET', timeoutMs: 10000 })
      setNode(payload?.node || null)
      setHasAccess(Boolean(payload?.hasAccess ?? payload?.node?.is_free))
      setArticles(Array.isArray(payload?.articles) ? payload.articles : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function search(nextKeyword = keyword) {
    const q = nextKeyword.trim()
    if (!q) return
    setKeyword(q)
    setLoading(true)
    setError('')
    setNode(null)
    setHasAccess(false)
    setArticles([])
    try {
      const payload = await apiClient.request<any>(`/api/knowledge/search?q=${encodeURIComponent(q)}&limit=20`, { method: 'GET', timeoutMs: 10000 })
      setResults(pickArray(payload, ['results', 'items', 'data']))
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : '搜索失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialId) {
      void loadNode(initialId)
      return
    }
    if (initialQuery) void search(initialQuery)
  }, [initialId, initialQuery])

  const contentText = normalizeContentBody(node?.content)
  const videoUrl = getVideoUrl(node)

  return (
    <Page>
      <HeroPanel title={node?.title || '知识搜索'} subtitle={node ? node.description || '动作标准、训练知识与相关内容。' : '按动作、计划、伤病或书籍搜索知识库。'} icon="icon-search" />

      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput accessibilityLabel="搜索知识库" value={keyword} onChangeText={setKeyword} placeholder="搜索动作、计划、伤病或书籍..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => search()} />
        <Pressable accessibilityRole="button" accessibilityLabel="搜索知识库" accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={() => search()} style={[styles.searchButton, loading && styles.disabled]}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? <SectionCard title="加载失败" description={error} /> : null}

      {node ? (
        <>
          <SectionCard title={node.node_type === 'video' ? '视频内容' : '内容详情'} description={node.description || undefined}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{node.node_type === 'video' ? '视频' : '文章'}</Text>
              {node.is_free ? <Text style={[styles.badge, styles.freeBadge]}>免费</Text> : null}
            </View>
            {Array.isArray(node.body_region) && node.body_region.length > 0 ? (
              <View style={styles.tags}>{node.body_region.map((tag: string) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
            ) : null}
            {!hasAccess ? (
              <View style={styles.lockedPanel}>
                <Text style={styles.lockedTitle}>订阅后可查看完整内容</Text>
                <Text style={styles.empty}>正文和视频未下发到当前设备，可前往登录或会员页检查权限。</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={isAuthenticated ? '查看会员方案' : '去登录'} onPress={() => navigation.navigate(isAuthenticated ? 'Membership' : 'Login')} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{isAuthenticated ? '查看会员' : '去登录'}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {videoUrl ? <NativeVideoPlayer url={videoUrl} title={node.title || '知识视频'} /> : null}
                {contentText ? <Text style={styles.contentText}>{contentText}</Text> : !videoUrl ? <Text style={styles.empty}>暂无详细内容。</Text> : null}
              </>
            )}
          </SectionCard>

          {articles.length > 0 ? (
            <SectionCard title="相关教练文章">
              {articles.map((item) => <RowCard key={String(item.id)} title={item.title || '教练文章'} subtitle={item.coaches?.name || '点击查看相关内容'} icon="icon-knowledge" onPress={() => navigation.navigate('CoachContentDetail', { id: item.id })} />)}
            </SectionCard>
          ) : null}
        </>
      ) : (
        <SectionCard title="搜索结果" description={keyword ? `关键词：${keyword}` : '输入关键词后按回车或点击搜索。'}>
          {results.length === 0 && !loading ? <Text style={styles.empty}>{keyword ? '暂无匹配内容。' : '可以搜索平台期、动作标准、肩腕腰痛或训练计划。'}</Text> : null}
          {results.map((item) => (
            <RowCard key={String(item.id)} title={item.title || '知识内容'} subtitle={item.description || '点击查看内容'} icon="icon-knowledge" onPress={() => loadNode(item.id)} />
          ))}
        </SectionCard>
      )}

      <View style={styles.footerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回上一页" onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
      </View>
    </Page>
  )
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  badge: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '600' },
  freeBadge: { color: colors.success, backgroundColor: '#EAF6EE' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  tag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  contentText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  lockedPanel: { gap: spacing.sm },
  lockedTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  empty: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  footerActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
})
