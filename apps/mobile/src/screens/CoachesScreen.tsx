import { useEffect, useState } from 'react'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../api'
import { Page } from '../components/Page'
import { SectionCard } from '../components/SectionCard'
import { IconFont } from '../components/IconFont'
import { colors, radius, spacing } from '../theme'
import { HeroPanel, RowCard } from './AppHomeShared'
import type { MainTabParamList } from '../navigation/types'

type Props = BottomTabScreenProps<MainTabParamList, 'CoachesTab'>

type VisibilityStatus = {
  focusMode: boolean
  focusCoachId: string | null
  focusCoachName: string | null
  referrerCoachId: string | null
  referrerCoachName: string | null
}

const coachesPerPage = 10

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function isTestCoach(coach?: any) {
  const name = String(coach?.name || '').trim().toLowerCase()
  return name.startsWith('e2e coach') || /\be2e coach\b/.test(name)
}

function normalizeCoachList(data: any) {
  return pickArray(data, ['coaches', 'items', 'data']).filter((coach) => !isTestCoach(coach))
}

export function CoachesScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  const [coaches, setCoaches] = useState<any[]>([])
  const [coachBuffer, setCoachBuffer] = useState<any[]>([])
  const [nextCoachPage, setNextCoachPage] = useState(1)
  const [rawHasMoreCoaches, setRawHasMoreCoaches] = useState(false)
  const [specialties, setSpecialties] = useState<Array<{ label: string; value: string }>>([{ label: '全部方向', value: 'all' }])
  const [selected, setSelected] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus | null>(null)
  const [visibilityLoading, setVisibilityLoading] = useState(true)

  const hasMoreCoaches = rawHasMoreCoaches || coachBuffer.length > 0

  async function load(mode: 'reset' | 'append' = 'reset', filters?: { specialty?: string; search?: string }) {
    setLoading(true)
    try {
      if (visibilityStatus?.focusMode && visibilityStatus.focusCoachId) {
        const res = await apiClient.request('/api/coach/get-coach', { method: 'POST', body: { id: visibilityStatus.focusCoachId }, timeoutMs: 10000 })
        const focusedCoach = (res as any).data?.coach || (res as any).data?.data?.coach || (res as any).data
        setCoaches(focusedCoach && !isTestCoach(focusedCoach) ? [focusedCoach] : [])
        setCoachBuffer([])
        setNextCoachPage(1)
        setRawHasMoreCoaches(false)
        return
      }

      let visiblePool = mode === 'append' ? [...coachBuffer] : []
      let rawPage = mode === 'append' ? nextCoachPage : 1
      let rawHasMore = mode === 'append' ? rawHasMoreCoaches : true
      const nextSpecialty = filters?.specialty ?? selected
      const nextSearch = filters?.search ?? search

      while (visiblePool.length < coachesPerPage && rawHasMore) {
        const res = await apiClient.request('/api/coach/get-all-coaches', {
          method: 'POST',
          body: {
            page: rawPage,
            limit: coachesPerPage,
            search: nextSearch,
            specialty: nextSpecialty === 'all' ? 'all' : nextSpecialty,
          },
          timeoutMs: 10000,
        })
        const rawList = normalizeCoachList((res as any).data)
        visiblePool = visiblePool.concat(rawList)
        const total = Math.max(Number((res as any).data?.count || (res as any).data?.total || (res as any).data?.data?.count || 0), 0)
        rawHasMore = rawList.length === coachesPerPage && (total <= 0 || rawPage * coachesPerPage < total)
        rawPage += 1
        if (rawList.length === 0) rawHasMore = false
      }

      const nextBatch = visiblePool.slice(0, coachesPerPage)
      const remainingBuffer = visiblePool.slice(coachesPerPage)

      setCoaches((prev) => (mode === 'append' ? [...prev, ...nextBatch] : nextBatch))
      setCoachBuffer(remainingBuffer)
      setNextCoachPage(rawPage)
      setRawHasMoreCoaches(rawHasMore)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    async function bootstrap() {
      setVisibilityLoading(true)
      try {
        const [visibilityRes, specRes] = await Promise.allSettled([
          apiClient.request('/api/student/visibility-status', { method: 'GET', timeoutMs: 10000 }),
          apiClient.request('/api/coach/get-specialties', { method: 'GET', timeoutMs: 10000 }),
        ])
        if (!alive) return
        if (visibilityRes.status === 'fulfilled') {
          const status = (visibilityRes.value as any).data?.status || (visibilityRes.value as any).data
          setVisibilityStatus(status || null)
        }
        if (specRes.status === 'fulfilled') {
          const rows = pickArray((specRes.value as any).data, ['specialties', 'items'])
          if (rows.length) setSpecialties([{ label: '全部方向', value: 'all' }, ...rows.map((row) => ({ label: row.name || row.label || String(row), value: row.name || row.value || String(row) }))])
        }
      } finally {
        if (alive) setVisibilityLoading(false)
      }
    }
    void bootstrap()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!visibilityLoading) void load('reset')
  }, [visibilityLoading, visibilityStatus?.focusMode, visibilityStatus?.focusCoachId])

  const onSearch = () => {
    if (visibilityStatus?.focusMode) return
    void load('reset', { specialty: selected, search })
  }

  return (
    <Page>
      <HeroPanel
        title={visibilityStatus?.focusMode ? '我的专属教练' : '教练'}
        subtitle={visibilityStatus?.focusMode ? `你正通过 ${visibilityStatus.focusCoachName || '教练'} 的邀请在这里训练和沟通。` : '这里只做找教练，方向合适了再继续往下聊。'}
        icon="icon-discovery"
      />

      {!visibilityStatus?.focusMode ? (
        <>
          <View style={styles.searchBox}>
            <IconFont name="icon-search" color={colors.textMuted} size={18} />
            <TextInput value={search} onChangeText={setSearch} placeholder="搜索教练名字或专项方向" placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={onSearch} />
            <Pressable onPress={onSearch} style={styles.searchButton}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {specialties.map((item) => (
              <Pressable key={item.value} onPress={() => { setSelected(item.value); void load('reset', { specialty: item.value, search }) }} style={[styles.chip, selected === item.value && styles.chipActive]}>
                <Text style={[styles.chipText, selected === item.value && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionCard title="推荐教练" description="按方向筛，点进详情看风格、经验和服务。">
        {loading || visibilityLoading ? <ActivityIndicator color={colors.brand} /> : null}
        {!visibilityStatus?.focusMode ? (
          <Text style={styles.statsText}>{hasMoreCoaches ? `已先展示 ${coaches.length} 位教练` : `当前共展示 ${coaches.length} 位教练`}</Text>
        ) : null}
        {coaches.length === 0 && !loading && !visibilityLoading ? <Text style={styles.empty}>{visibilityStatus?.focusMode ? '教练信息加载失败。' : '没有找到相关教练。'}</Text> : null}
        {coaches.map((coach) => (
          <Pressable key={coach.id} onPress={() => rootNav?.navigate('CoachProfile', { id: coach.id })} style={({ pressed }) => [styles.coachCard, pressed && styles.pressed]}>
            <View>
              {coach.avatar_url ? <Image source={{ uri: coach.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{String(coach.name || '教').slice(0, 1)}</Text></View>}
              {coach.is_featured ? <View style={styles.featuredBadge}><IconFont name="icon-star" color="#FFFFFF" size={12} /></View> : null}
            </View>
            <View style={styles.coachMain}>
              <View style={styles.nameRow}>
                <Text style={styles.coachName}>{coach.name || '未命名教练'}</Text>
                <View style={styles.ratingBadge}>
                  <IconFont name="icon-star" color={colors.brand} size={10} />
                  <Text style={styles.ratingText}>{typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : typeof coach.rating === 'number' ? coach.rating.toFixed(1) : '0.0'}</Text>
                </View>
              </View>
              <View style={styles.tagsRow}>
                {(Array.isArray(coach.specialties) && coach.specialties.length ? coach.specialties.slice(0, 2) : [coach.bio || '专项教练']).map((tag: string, index: number) => (
                  <View key={`${coach.id}-${tag}-${index}`} style={styles.tagItem}><Text style={styles.tagText}>{tag}</Text></View>
                ))}
              </View>
            </View>
            {typeof coach.subscription_price_tier1 === 'number' ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>起价</Text>
                <Text style={styles.priceValue}>¥{coach.subscription_price_tier1}</Text>
              </View>
            ) : null}
            <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
          </Pressable>
        ))}
        {hasMoreCoaches && !visibilityStatus?.focusMode ? (
          <Pressable onPress={() => load('append')} style={styles.loadMore}>
            {loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.loadMoreText}>加载更多</Text>}
          </Pressable>
        ) : null}
        {!visibilityStatus?.focusMode && coaches.length > 0 && !hasMoreCoaches ? <Text style={styles.endText}>当前教练已全部展示</Text> : null}
      </SectionCard>

      <SectionCard title="服务入口" description="对应小程序教练发现的问卷、榜单和市场入口。">
        <RowCard title="服务市场" subtitle="按商品筛选服务，支持购买和加入购物车" icon="icon-discovery" onPress={() => rootNav?.navigate('CoachMarket')} />
        <RowCard title="排行榜" subtitle="查看街健与社区榜单" icon="icon-ranking" onPress={() => rootNav?.navigate('Ranking')} />
        <RowCard title="我的教练" subtitle="订阅过或正在服务你的教练" icon="icon-coachline_line" onPress={() => rootNav?.navigate('MyCoaches')} />
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
  chipActive: { backgroundColor: colors.brand },
  chipText: { color: colors.textSecondary, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  avatarFallback: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  avatarText: { color: colors.brand, fontSize: 20, fontWeight: '900' },
  featuredBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.surface },
  coachMain: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  coachName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  ratingBadge: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.pill, paddingHorizontal: 6, backgroundColor: colors.brandSoft },
  ratingText: { color: colors.brand, fontSize: 11, fontWeight: '800' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tagItem: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, backgroundColor: colors.surfaceMuted },
  tagText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  priceBox: { alignItems: 'flex-end', gap: 2 },
  priceLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  priceValue: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  statsText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  loadMoreText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  endText: { textAlign: 'center', color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.72 },
})
