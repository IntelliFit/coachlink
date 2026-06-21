import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { useAuth } from '../../providers/AuthProvider'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { HeroPanel } from '../AppHomeShared'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'CoachMarket'>

type PricingTier = 'basic' | 'standard' | 'vip'
type TierFilter = 'all' | PricingTier

type DurationOption = {
  months: number
  price: number
  is_recommend?: boolean
}

type ProductLite = {
  id: string
  tier: PricingTier
  name: string
  description?: string
  included_products?: string[]
  duration_options: DurationOption[]
}

type MarketItem = {
  id: string
  coach: any
  product: ProductLite
  minPrice: number | null
}

const COACH_PAGE_LIMIT = 50
const MAX_COACH_PAGES = 4
const PRICING_CONCURRENCY = 4

const tierFilters: Array<{ key: TierFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'basic', label: '基础' },
  { key: 'standard', label: '专业' },
  { key: 'vip', label: '全能' },
]

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function normalizeTier(value: unknown): PricingTier {
  const str = String(value || '').toLowerCase()
  if (str === 'standard' || str === 'vip') return str
  return 'basic'
}

function normalizeDurationOptions(rawOptions: unknown): DurationOption[] {
  if (!Array.isArray(rawOptions)) return []
  return rawOptions
    .map((option: any) => ({
      months: Number(option?.months),
      price: Number(option?.price),
      is_recommend: Boolean(option?.is_recommend),
    }))
    .filter((option) => Number.isFinite(option.months) && option.months > 0 && Number.isFinite(option.price) && option.price >= 0)
    .sort((a, b) => a.months - b.months)
}

function normalizeProduct(rawProduct: any, index: number): ProductLite | null {
  const durationOptions = normalizeDurationOptions(rawProduct?.duration_options)
  if (!durationOptions.length) return null
  return {
    id: String(rawProduct?.id || '').trim() || `product-${index}`,
    tier: normalizeTier(rawProduct?.tier),
    name: String(rawProduct?.name || '').trim() || `订阅方案 ${index + 1}`,
    description: typeof rawProduct?.description === 'string' ? rawProduct.description : '',
    included_products: Array.isArray(rawProduct?.included_products) ? rawProduct.included_products.filter((item: unknown) => typeof item === 'string') : [],
    duration_options: durationOptions,
  }
}

function getMinPrice(durationOptions: DurationOption[]): number | null {
  const prices = durationOptions.map((item) => item.price).filter((price) => Number.isFinite(price))
  return prices.length ? Math.min(...prices) : null
}

function formatPrice(price: number | null | undefined) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '—'
  return Number.isInteger(price) ? `¥${price}` : `¥${price.toFixed(2)}`
}

function tierLabel(tier: PricingTier) {
  if (tier === 'basic') return '基础'
  if (tier === 'standard') return '专业'
  return '全能'
}

function isTestCoach(coach?: any) {
  const name = String(coach?.name || '').trim().toLowerCase()
  return name.startsWith('e2e coach') || /\be2e coach\b/.test(name)
}

export function CoachMarketScreen({ navigation }: Props) {
  const { isAuthenticated, isGuest } = useAuth()
  const [marketItems, setMarketItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierFilter>('all')
  const [addingKey, setAddingKey] = useState('')
  const loadingRef = useRef(false)

  const ensureLogin = useCallback(() => {
    if (isAuthenticated && !isGuest) return true
    Alert.alert('请先登录后再操作', '登录后可以购买服务或加入购物车。', [
      { text: '取消', style: 'cancel' },
      { text: '去登录', onPress: () => navigation.navigate('Login') },
    ])
    return false
  }, [isAuthenticated, isGuest, navigation])

  const loadMarketData = useCallback(async (mode: 'init' | 'refresh' = 'init') => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (mode === 'init') setLoading(true)
    else setRefreshing(true)
    setErrorMsg('')

    try {
      const coaches: any[] = []
      let page = 1
      let totalCount = 0

      while (page <= MAX_COACH_PAGES) {
        const res = await apiClient.request('/api/coach/get-all-coaches', {
          method: 'POST',
          body: { page, limit: COACH_PAGE_LIMIT, search: '', specialty: 'all' },
          timeoutMs: 12000,
        })
        const list = pickArray((res as any).data, ['coaches', 'items']).filter((coach) => !isTestCoach(coach))
        if (!list.length) break
        coaches.push(...list)
        totalCount = typeof (res as any).data?.count === 'number' ? (res as any).data.count : coaches.length
        if (coaches.length >= totalCount || list.length < COACH_PAGE_LIMIT) break
        page += 1
      }

      const uniqueCoaches = Array.from(new Map(coaches.filter((coach) => coach?.id).map((coach) => [coach.id, coach])).values())
      const pricingMap = new Map<string, ProductLite[]>()
      let cursor = 0
      const workerCount = Math.min(PRICING_CONCURRENCY, uniqueCoaches.length)

      await Promise.all(Array.from({ length: workerCount }).map(async () => {
        while (cursor < uniqueCoaches.length) {
          const coach = uniqueCoaches[cursor]
          cursor += 1
          try {
            const res = await apiClient.request('/api/coach/get-pricing', { method: 'POST', body: { coachId: coach.id }, timeoutMs: 10000 })
            const products = pickArray((res as any).data, ['products', 'items'])
              .map((product: any, index: number) => normalizeProduct(product, index))
              .filter((product: ProductLite | null): product is ProductLite => Boolean(product))
            pricingMap.set(coach.id, products)
          } catch {
            pricingMap.set(coach.id, [])
          }
        }
      }))

      const nextItems: MarketItem[] = []
      uniqueCoaches.forEach((coach) => {
        const products = pricingMap.get(coach.id) || []
        products.forEach((product, index) => {
          nextItems.push({
            id: `${coach.id}-${product.id}-${index}`,
            coach,
            product,
            minPrice: getMinPrice(product.duration_options),
          })
        })
      })

      const sortedItems = nextItems.sort((a, b) => {
        const aFeatured = a.coach.is_featured ? 1 : 0
        const bFeatured = b.coach.is_featured ? 1 : 0
        if (aFeatured !== bFeatured) return bFeatured - aFeatured
        const aPrice = typeof a.minPrice === 'number' ? a.minPrice : Number.MAX_SAFE_INTEGER
        const bPrice = typeof b.minPrice === 'number' ? b.minPrice : Number.MAX_SAFE_INTEGER
        if (aPrice !== bPrice) return aPrice - bPrice
        return String(a.coach.name || '').localeCompare(String(b.coach.name || ''))
      })

      setMarketItems(sortedItems)
      if (!sortedItems.length) setErrorMsg('当前暂无可购买的商品，可先去教练主页查看订阅方案。')
    } catch (error: any) {
      setMarketItems([])
      setErrorMsg(error?.message || '加载服务市场失败，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    void loadMarketData('init')
  }, [loadMarketData])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return marketItems.filter((item) => {
      if (selectedTier !== 'all' && item.product.tier !== selectedTier) return false
      if (!normalizedQuery) return true
      return [
        item.coach.name || '',
        item.coach.title || '',
        Array.isArray(item.coach.specialties) ? item.coach.specialties.join(' ') : '',
        item.product.name || '',
        item.product.description || '',
        Array.isArray(item.product.included_products) ? item.product.included_products.join(' ') : '',
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [marketItems, query, selectedTier])

  const handleBuy = useCallback((item: MarketItem, option: DurationOption) => {
    if (!ensureLogin()) return
    navigation.navigate('PaymentWebview', { coachId: item.coach.id, productId: item.product.id, months: option.months })
  }, [ensureLogin, navigation])

  const handleAddToCart = useCallback(async (item: MarketItem, option: DurationOption) => {
    if (!ensureLogin()) return
    const actionKey = `${item.id}-${option.months}`
    if (addingKey === actionKey) return
    setAddingKey(actionKey)
    try {
      const res = await apiClient.request('/api/cart/add', {
        method: 'POST',
        body: {
          coachId: item.coach.id,
          coachName: item.coach.name || '教练',
          productId: item.product.id,
          productName: item.product.name,
          productTier: item.product.tier,
          durationMonths: option.months,
          price: option.price,
        },
        timeoutMs: 10000,
      })
      if ((res as any).data?.success === false) throw new Error((res as any).data?.error || '加入购物车失败')
      Alert.alert('已加入购物车', `${item.product.name}（${option.months}个月）`, [
        { text: '继续选购', style: 'cancel' },
        { text: '去购物车', onPress: () => navigation.navigate('Cart') },
      ])
    } catch (error: any) {
      Alert.alert('加入购物车失败', error?.message || '请稍后重试')
    } finally {
      setAddingKey('')
    }
  }, [addingKey, ensureLogin, navigation])

  return (
    <Page>
      <HeroPanel title="服务市场" subtitle="按商品筛选服务，支持直接购买或加入购物车。" icon="icon-discovery" />

      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput value={query} onChangeText={setQuery} placeholder="搜索教练、商品、专长..." placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierTabs}>
        {tierFilters.map((tier) => (
          <Pressable key={tier.key} onPress={() => setSelectedTier(tier.key)} style={[styles.tierTab, selectedTier === tier.key && styles.tierTabActive]}>
            <Text style={[styles.tierTabText, selectedTier === tier.key && styles.tierTabTextActive]}>{tier.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.resultBar}>
        <Text style={styles.resultText}>{refreshing ? '刷新中...' : `共 ${filteredItems.length} 个商品`}</Text>
        <Pressable onPress={() => navigation.navigate('Cart')} style={styles.cartButton}><Text style={styles.cartButtonText}>购物车</Text></Pressable>
      </View>

      <SectionCard title="商品列表" description="每个商品保留教练、套餐等级、服务内容和月份价格。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {!loading && errorMsg && filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{errorMsg}</Text>
            <Pressable onPress={() => loadMarketData('init')} style={styles.reloadButton}><Text style={styles.reloadText}>重新加载</Text></Pressable>
          </View>
        ) : null}
        {!loading && !errorMsg && filteredItems.length === 0 ? <Text style={styles.emptyTitle}>没有匹配的商品，换个关键词或筛选条件再试试。</Text> : null}

        {filteredItems.map((item) => (
          <View key={item.id} style={styles.marketCard}>
            <View style={styles.cardHead}>
              <Pressable onPress={() => navigation.navigate('CoachProfile', { id: item.coach.id })} style={styles.coachInfo}>
                {item.coach.avatar_url ? <Image source={{ uri: item.coach.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{String(item.coach.name || '教').slice(0, 1)}</Text></View>}
                <View style={styles.coachMeta}>
                  <View style={styles.coachRow}>
                    <Text style={styles.coachName}>{item.coach.name || '教练'}</Text>
                    {item.coach.is_featured ? <View style={styles.featuredBadge}><Text style={styles.featuredText}>推荐</Text></View> : null}
                  </View>
                  <Text style={styles.coachTitle}>{item.coach.title || '专业训练指导'}</Text>
                </View>
              </Pressable>
              <View style={[styles.tierBadge, item.product.tier === 'vip' ? styles.tier_vip : item.product.tier === 'standard' ? styles.tier_standard : styles.tier_basic]}><Text style={styles.tierBadgeText}>{tierLabel(item.product.tier)}</Text></View>
            </View>

            <View style={styles.productHead}>
              <View style={styles.productMain}>
                <Text style={styles.productName}>{item.product.name}</Text>
                {item.product.description ? <Text style={styles.productDesc}>{item.product.description}</Text> : null}
              </View>
              <View style={styles.minPriceWrap}>
                <Text style={styles.minPriceLabel}>起价</Text>
                <Text style={styles.minPriceValue}>{formatPrice(item.minPrice)}</Text>
              </View>
            </View>

            {item.product.included_products?.length ? (
              <View style={styles.includedTags}>
                {item.product.included_products.slice(0, 4).map((tag, index) => <View key={`${item.id}-tag-${index}`} style={styles.includedTag}><Text style={styles.includedTagText}>{tag}</Text></View>)}
              </View>
            ) : null}

            <View style={styles.durationList}>
              {item.product.duration_options.map((option) => {
                const actionKey = `${item.id}-${option.months}`
                const isAdding = addingKey === actionKey
                return (
                  <View key={`${item.id}-${option.months}`} style={styles.durationItem}>
                    <View style={styles.durationMeta}>
                      <View style={styles.durationLeft}>
                        <Text style={styles.durationMonths}>{option.months}个月</Text>
                        {option.is_recommend ? <Text style={styles.durationRecommend}>推荐</Text> : null}
                      </View>
                      <Text style={styles.durationPrice}>{formatPrice(option.price)}</Text>
                    </View>
                    <View style={styles.durationActions}>
                      <Pressable onPress={() => handleBuy(item, option)} style={styles.buyButton}><Text style={styles.buyButtonText}>购买</Text></Pressable>
                      <Pressable onPress={() => handleAddToCart(item, option)} disabled={isAdding} style={[styles.cartSmallButton, isAdding && styles.disabledButton]}><Text style={styles.cartSmallButtonText}>{isAdding ? '加入中' : '加购'}</Text></Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        ))}
      </SectionCard>
    </Page>
  )
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  tierTabs: { gap: spacing.xs, paddingVertical: spacing.xs },
  tierTab: { minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tierTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tierTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tierTabTextActive: { color: '#FFFFFF' },
  resultBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted },
  resultText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  cartButton: { minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  cartButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  emptyState: { gap: spacing.sm },
  emptyTitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  reloadButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.brand },
  reloadText: { color: '#FFFFFF', fontWeight: '900' },
  marketCard: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  coachInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  avatarFallback: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  avatarText: { color: colors.brand, fontSize: 18, fontWeight: '900' },
  coachMeta: { flex: 1, gap: 4 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  coachName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  coachTitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  featuredBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3, backgroundColor: colors.brand },
  featuredText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  tierBadge: { minHeight: 28, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.xs },
  tier_basic: { backgroundColor: '#EEF2FF' },
  tier_standard: { backgroundColor: '#ECFDF5' },
  tier_vip: { backgroundColor: '#FFF7ED' },
  tierBadgeText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  productHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  productMain: { flex: 1, gap: 4 },
  productName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  productDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  minPriceWrap: { alignItems: 'flex-end', gap: 2 },
  minPriceLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  minPriceValue: { color: colors.brand, fontSize: 18, fontWeight: '900' },
  includedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  includedTag: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 5, backgroundColor: colors.brandSoft },
  includedTagText: { color: colors.brand, fontSize: 11, fontWeight: '800' },
  durationList: { gap: spacing.xs },
  durationItem: { gap: spacing.xs, borderRadius: radius.md, padding: spacing.xs, backgroundColor: colors.surfaceMuted },
  durationMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  durationLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  durationMonths: { color: colors.text, fontSize: 14, fontWeight: '900' },
  durationRecommend: { color: colors.brand, fontSize: 11, fontWeight: '900' },
  durationPrice: { color: colors.text, fontSize: 15, fontWeight: '900' },
  durationActions: { flexDirection: 'row', gap: spacing.xs },
  buyButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  buyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  cartSmallButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  cartSmallButtonText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.58 },
})
