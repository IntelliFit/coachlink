import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

type PricingTier = 'basic' | 'standard' | 'vip'
type TierFilter = 'all' | PricingTier

interface CoachLite {
  id: string
  name: string
  title?: string | null
  avatar_url?: string | null
  specialties?: string[] | null
  is_featured?: boolean | null
}

interface DurationOption {
  months: number
  price: number
  is_recommend?: boolean
}

interface ProductLite {
  id: string
  tier: PricingTier
  name: string
  description?: string
  included_products?: string[]
  duration_options: DurationOption[]
}

interface MarketItem {
  id: string
  coach: CoachLite
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
  { key: 'vip', label: '全能' }
]

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
      is_recommend: !!option?.is_recommend
    }))
    .filter((option) => Number.isFinite(option.months) && option.months > 0 && Number.isFinite(option.price) && option.price >= 0)
    .sort((a, b) => a.months - b.months)
}

function normalizeProduct(rawProduct: any, index: number): ProductLite | null {
  const durationOptions = normalizeDurationOptions(rawProduct?.duration_options)
  if (!durationOptions.length) return null

  const name = String(rawProduct?.name || '').trim() || `订阅方案 ${index + 1}`
  const productId = String(rawProduct?.id || '').trim() || `product-${index}`

  return {
    id: productId,
    tier: normalizeTier(rawProduct?.tier),
    name,
    description: typeof rawProduct?.description === 'string' ? rawProduct.description : '',
    included_products: Array.isArray(rawProduct?.included_products)
      ? rawProduct.included_products.filter((item: unknown) => typeof item === 'string')
      : [],
    duration_options: durationOptions
  }
}

function getMinPrice(durationOptions: DurationOption[]): number | null {
  const prices = durationOptions.map((item) => item.price).filter((price) => Number.isFinite(price))
  return prices.length ? Math.min(...prices) : null
}

function formatPrice(price: number | null | undefined): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '—'
  return Number.isInteger(price) ? `¥${price}` : `¥${price.toFixed(2)}`
}

function tierLabel(tier: PricingTier): string {
  if (tier === 'basic') return '基础'
  if (tier === 'standard') return '专业'
  return '全能'
}

function Market() {
  const { effectiveTheme } = useTheme()
  const [marketItems, setMarketItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierFilter>('all')
  const [addingKey, setAddingKey] = useState('')

  const loadingRef = useRef(false)

  const loadMarketData = useCallback(async (mode: 'init' | 'refresh' = 'init') => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (mode === 'init') {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setErrorMsg('')

    try {
      const coaches: CoachLite[] = []
      let page = 1
      let totalCount = 0

      while (page <= MAX_COACH_PAGES) {
        const result = await coachService.getAllCoaches({
          page,
          limit: COACH_PAGE_LIMIT,
          search: '',
          specialty: 'all'
        })

        if (!result) break

        const list = Array.isArray(result.coaches) ? (result.coaches as CoachLite[]) : []
        if (list.length === 0) break

        coaches.push(...list)
        totalCount = typeof result.count === 'number' ? result.count : coaches.length

        if (coaches.length >= totalCount || list.length < COACH_PAGE_LIMIT) break
        page += 1
      }

      const uniqueCoaches = Array.from(
        new Map(
          coaches
            .filter((coach) => !!coach?.id)
            .map((coach) => [coach.id, coach])
        ).values()
      )

      const pricingMap = new Map<string, ProductLite[]>()
      let cursor = 0
      const workerCount = Math.min(PRICING_CONCURRENCY, uniqueCoaches.length)

      const workers = Array.from({ length: workerCount }).map(async () => {
        while (cursor < uniqueCoaches.length) {
          const current = uniqueCoaches[cursor]
          cursor += 1

          try {
            const pricingRes = await coachService.getPricing({ coachId: current.id })
            const rawProducts = Array.isArray(pricingRes?.products) ? pricingRes.products : []
            const normalizedProducts = rawProducts
              .map((product: any, index: number) => normalizeProduct(product, index))
              .filter((product: ProductLite | null): product is ProductLite => !!product)

            pricingMap.set(current.id, normalizedProducts)
          } catch (error) {
            console.error('[market] 获取定价失败:', current.id, error)
            pricingMap.set(current.id, [])
          }
        }
      })

      await Promise.all(workers)

      const nextItems: MarketItem[] = []

      uniqueCoaches.forEach((coach) => {
        const products = pricingMap.get(coach.id) || []
        products.forEach((product, idx) => {
          nextItems.push({
            id: `${coach.id}-${product.id}-${idx}`,
            coach,
            product,
            minPrice: getMinPrice(product.duration_options || [])
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

        return (a.coach.name || '').localeCompare(b.coach.name || '')
      })

      setMarketItems(sortedItems)
      if (!sortedItems.length) {
        setErrorMsg('当前暂无可购买的商品，可先去教练主页查看订阅方案。')
      }
    } catch (error: any) {
      console.error('[market] load data error:', error)
      setMarketItems([])
      setErrorMsg(error?.message || '加载服务市场失败，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
      loadingRef.current = false
    }
  }, [])

  useDidShow(() => {
    if (!initialized) {
      setInitialized(true)
      void loadMarketData('init')
      return
    }
    void loadMarketData('refresh')
  })

  usePullDownRefresh(() => {
    loadMarketData('refresh').finally(() => Taro.stopPullDownRefresh())
  })

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return marketItems.filter((item) => {
      if (selectedTier !== 'all' && item.product.tier !== selectedTier) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchText = [
        item.coach.name || '',
        item.coach.title || '',
        Array.isArray(item.coach.specialties) ? item.coach.specialties.join(' ') : '',
        item.product.name || '',
        item.product.description || '',
        Array.isArray(item.product.included_products) ? item.product.included_products.join(' ') : ''
      ]
        .join(' ')
        .toLowerCase()

      return searchText.includes(normalizedQuery)
    })
  }, [marketItems, query, selectedTier])

  const ensureLogin = useCallback((returnTo: string) => {
    const user = authService.getCurrentUser()
    if (user?.id) return true

    Taro.showToast({ title: '请先登录后再操作', icon: 'none' })
    Taro.navigateTo({
      url: '/auth/login?returnTo=' + encodeURIComponent(returnTo)
    })
    return false
  }, [])

  const handleGoCoachProfile = useCallback((coachId: string) => {
    if (!coachId) {
      Taro.showToast({ title: '缺少教练信息', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/discovery/coach-profile?id=${encodeURIComponent(coachId)}&tab=1`
    })
  }, [])

  const handleBuy = useCallback((item: MarketItem, option: DurationOption) => {
    if (!ensureLogin('/discovery/market')) return

    if (!item.coach.id || !item.product.id || option.months <= 0) {
      Taro.showToast({ title: '商品信息不完整，无法购买', icon: 'none' })
      return
    }

    Taro.navigateTo({
      url: `/discovery/coach-profile?id=${encodeURIComponent(item.coach.id)}&tab=1`
    })
  }, [ensureLogin])

  const handleAddToCart = useCallback(async (item: MarketItem, option: DurationOption) => {
    if (!ensureLogin('/discovery/market')) return

    const actionKey = `${item.id}-${option.months}`
    if (addingKey === actionKey) return

    setAddingKey(actionKey)

    try {
      const res = await request({
        url: '/api/cart/add',
        method: 'POST',
        data: {
          coachId: item.coach.id,
          coachName: item.coach.name || '教练',
          productId: item.product.id,
          productName: item.product.name,
          productTier: item.product.tier,
          durationMonths: option.months,
          price: option.price
        }
      })

      if (!res.success) return

      Taro.showModal({
        title: '已加入购物车',
        content: `${item.product.name}（${option.months}个月）`,
        confirmText: '去购物车',
        cancelText: '继续选购',
        success: (modalRes) => {
          if (modalRes.confirm) {
            Taro.navigateTo({ url: '/me/cart/index' })
          }
        }
      })
    } catch (error) {
      console.error('[market] add cart failed:', error)
      Taro.showToast({ title: '加入购物车失败', icon: 'none' })
    } finally {
      setAddingKey('')
    }
  }, [addingKey, ensureLogin])

  const renderSkeleton = () => (
    <View className='market-list'>
      {[1, 2, 3].map((index) => (
        <View key={index} className='skeleton-card'>
          <View className='skeleton-line skeleton-title' />
          <View className='skeleton-line skeleton-subtitle' />
          <View className='skeleton-line skeleton-row' />
          <View className='skeleton-line skeleton-row' />
        </View>
      ))}
    </View>
  )

  return (
    <View className={`market-page theme-${effectiveTheme}`}>
      <View className='page-header'>
        <Text className='page-title'>服务市场</Text>
        <Text className='page-subtitle'>按商品筛选服务，支持直接购买或加入购物车</Text>
      </View>

      <View className='search-wrap'>
        <Input
          className='search-input'
          placeholder='搜索教练、商品、专长...'
          value={query}
          onInput={(e) => setQuery(e.detail.value)}
          confirmType='search'
        />
      </View>

      <View className='tier-tabs'>
        {tierFilters.map((tier) => (
          <View
            key={tier.key}
            className={`tier-tab ${selectedTier === tier.key ? 'tier-tab-active' : ''}`}
            onClick={() => setSelectedTier(tier.key)}
          >
            <Text>{tier.label}</Text>
          </View>
        ))}
      </View>

      <View className='result-bar'>
        <Text className='result-text'>
          {refreshing ? '刷新中...' : `共 ${filteredItems.length} 个商品`}
        </Text>
        <View className='result-cart-btn' onClick={() => Taro.navigateTo({ url: '/me/cart/index' })}>
          <Text>购物车</Text>
        </View>
      </View>

      {loading ? (
        renderSkeleton()
      ) : errorMsg && filteredItems.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-title'>{errorMsg}</Text>
          <View className='empty-actions'>
            <View className='empty-btn' onClick={() => void loadMarketData('init')}>
              <Text>重新加载</Text>
            </View>
            <View className='empty-btn outline' onClick={() => Taro.navigateTo({ url: '/discovery/index' })}>
              <Text>去发现教练</Text>
            </View>
          </View>
        </View>
      ) : filteredItems.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-title'>没有匹配的商品</Text>
          <Text className='empty-desc'>换个关键词或切换筛选条件再试试</Text>
        </View>
      ) : (
        <View className='market-list'>
          {filteredItems.map((item) => (
            <View key={item.id} className='market-card'>
              <View className='card-head'>
                <View className='coach-info' onClick={() => handleGoCoachProfile(item.coach.id)}>
                  <View className='coach-avatar-wrap'>
                    {item.coach.avatar_url ? (
                      <Image className='coach-avatar' mode='aspectFill' src={item.coach.avatar_url} />
                    ) : (
                      <View className='coach-avatar-placeholder'>
                        <Text>{(item.coach.name || '教').slice(0, 1)}</Text>
                      </View>
                    )}
                  </View>
                  <View className='coach-meta'>
                    <View className='coach-row'>
                      <Text className='coach-name'>{item.coach.name || '教练'}</Text>
                      {item.coach.is_featured ? (
                        <View className='featured-badge'>
                          <Text>推荐</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className='coach-title'>{item.coach.title || '专业训练指导'}</Text>
                  </View>
                </View>
                <View className={`tier-badge tier-${item.product.tier}`}>
                  <Text>{tierLabel(item.product.tier)}</Text>
                </View>
              </View>

              <View className='product-head'>
                <View className='product-main'>
                  <Text className='product-name'>{item.product.name}</Text>
                  {item.product.description ? (
                    <Text className='product-desc'>{item.product.description}</Text>
                  ) : null}
                </View>
                <View className='min-price-wrap'>
                  <Text className='min-price-label'>起价</Text>
                  <Text className='min-price-value'>{formatPrice(item.minPrice)}</Text>
                </View>
              </View>

              {Array.isArray(item.product.included_products) && item.product.included_products.length > 0 ? (
                <View className='included-tags'>
                  {item.product.included_products.slice(0, 4).map((tag, index) => (
                    <View key={`${item.id}-included-${index}`} className='included-tag'>
                      <Text>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View className='duration-list'>
                {(item.product.duration_options || []).map((option) => {
                  const actionKey = `${item.id}-${option.months}`
                  const isAdding = addingKey === actionKey
                  return (
                    <View key={`${item.id}-duration-${option.months}`} className='duration-item'>
                      <View className='duration-meta'>
                        <View className='duration-left'>
                          <Text className='duration-months'>{option.months}个月</Text>
                          {option.is_recommend ? (
                            <Text className='duration-recommend'>推荐</Text>
                          ) : null}
                        </View>
                        <Text className='duration-price'>{formatPrice(option.price)}</Text>
                      </View>

                      <View className='duration-actions'>
                        <View className='duration-btn buy' onClick={() => handleBuy(item, option)}>
                          <Text>购买</Text>
                        </View>
                        <View
                          className={`duration-btn cart ${isAdding ? 'duration-btn-disabled' : ''}`}
                          onClick={() => {
                            if (!isAdding) {
                              void handleAddToCart(item, option)
                            }
                          }}
                        >
                          <Text>{isAdding ? '加入中' : '加购'}</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      <BottomNav />
    </View>
  )
}

export default Market
