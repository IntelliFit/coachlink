import React from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import { Star, Clock, Search, Heart, Lock, Eye } from '@nutui/icons-react-taro'
import Taro, { useReachBottom } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import { addPublicToMyLib, listPublicActions } from '@/services/actionLibPageService'
import type { PublicActionItemDto } from '@/types/action'
import { knowledgeService } from '@/services/knowledgeService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Coach {
    id: string
    name: string
    avatar_url?: string
    bio?: string
    rating?: number
    averageRating?: number
    specialties?: string[]
    studentCount?: number
    years_experience?: number
    subscription_price_tier1?: number
    is_featured?: boolean
}

interface VisibilityStatus {
    focusMode: boolean
    focusCoachId: string | null
    focusCoachName: string | null
    referrerCoachId: string | null
    referrerCoachName: string | null
}

type PricingTier = 'basic' | 'standard' | 'vip'

interface MarketDurationOption {
    months: number
    price: number
    is_recommend?: boolean
}

interface MarketProduct {
    id: string
    tier: PricingTier
    name: string
    description?: string
    duration_options: MarketDurationOption[]
}

interface MarketHighlightItem {
    id: string
    coachId: string
    coachName: string
    coachAvatarUrl?: string
    coachTitle?: string
    coachFeatured?: boolean
    productId: string
    productName: string
    productTier: PricingTier
    productDesc?: string
    durationMonths: number
    price: number
    recommend?: boolean
}

interface ArticleHighlightItem {
    id: string
    title: string
    summary: string
    coachName: string
    coachAvatarUrl?: string
    canView: boolean
    createdAt?: string
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeTier(value: unknown): PricingTier {
    const tier = String(value || '').toLowerCase()
    if (tier === 'standard' || tier === 'vip') return tier
    return 'basic'
}

function normalizeDurationOptions(rawOptions: unknown): MarketDurationOption[] {
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

function formatPrice(price?: number): string {
    if (typeof price !== 'number' || !Number.isFinite(price)) return '—'
    return Number.isInteger(price) ? `¥${price}` : `¥${price.toFixed(2)}`
}

function tierLabel(tier: PricingTier): string {
    if (tier === 'standard') return '专业'
    if (tier === 'vip') return '全能'
    return '基础'
}

function formatDate(dateText?: string): string {
    if (!dateText) return ''
    const time = new Date(dateText).getTime()
    if (!Number.isFinite(time)) return ''
    return new Date(time).toLocaleDateString('zh-CN')
}

function isTestCoach(coach?: Partial<Coach> | null): boolean {
    const name = String(coach?.name || '').trim().toLowerCase()
    return name.startsWith('e2e coach') || /\be2e coach\b/.test(name)
}

function truncateText(text: string, maxLength: number): string {
    const chars = Array.from(text)
    if (chars.length <= maxLength) return text
    return `${chars.slice(0, maxLength).join('')}...`
}

function summarizeActionDetail(detail?: string): string {
    const plainText = stripHtml(detail || '')
    if (!plainText) return '点击查看动作细节与要点'
    return truncateText(plainText, 56)
}

function Discovery() {
    const [coaches, setCoaches] = React.useState<Coach[]>([])
    const [specialties, setSpecialties] = React.useState<{ label: string; value: string }[]>([
        { label: '所有专长', value: 'all' }
    ])
    const [searchTerm, setSearchTerm] = React.useState('')
    const [isLoading, setIsLoading] = React.useState(false)
    const [selectedSpecialty, setSelectedSpecialty] = React.useState<string>('all')
    const coachesPerPage = 10
    const [nextCoachPage, setNextCoachPage] = React.useState(1)
    const [coachBuffer, setCoachBuffer] = React.useState<Coach[]>([])
    const [rawHasMoreCoaches, setRawHasMoreCoaches] = React.useState(false)
    
    // 视野状态
    const [visibilityStatus, setVisibilityStatus] = React.useState<VisibilityStatus | null>(null)
    const [visibilityLoading, setVisibilityLoading] = React.useState(true)
    const [marketHighlights, setMarketHighlights] = React.useState<MarketHighlightItem[]>([])
    const [marketLoading, setMarketLoading] = React.useState(false)
    const [addingMarketKey, setAddingMarketKey] = React.useState('')
    const [actionHighlights, setActionHighlights] = React.useState<PublicActionItemDto[]>([])
    const [actionLoading, setActionLoading] = React.useState(false)
    const [addingActionKey, setAddingActionKey] = React.useState('')
    const [articleHighlights, setArticleHighlights] = React.useState<ArticleHighlightItem[]>([])
    const [articleLoading, setArticleLoading] = React.useState(false)
    const hasMoreCoaches = rawHasMoreCoaches || coachBuffer.length > 0

    // 先获取视野状态
    React.useEffect(() => {
        const fetchVisibilityStatus = async () => {
            try {
                const status = await studentService.getVisibilityStatus()
                if (status) {
                    setVisibilityStatus(status)
                }
            } catch (error) {
                console.error('获取视野状态失败:', error)
            } finally {
                setVisibilityLoading(false)
            }
        }
        fetchVisibilityStatus()
    }, [])

    // 加载专长列表
    const loadSpecialties = async () => {
        try {
            const specialtiesData = await coachService.getAllSpecialties()
            if (specialtiesData) {
                const formattedSpecialties = specialtiesData.map(specialty => ({
                    label: specialty.name,
                    value: specialty.name
                }))
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties])
            }
        } catch (e) {
            console.error('加载专长失败:', e)
            Taro.showToast({
                title: '加载专长失败',
                icon: 'none'
            })
        }
    }

    // 加载教练列表
    const loadCoaches = async (
        mode: 'reset' | 'append' = 'reset',
        filters?: { search?: string; specialty?: string }
    ) => {
        setIsLoading(true)
        try {
            // 如果处于专注模式，只加载专注的教练
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId })
                const focusedCoach = res?.coach as Coach | undefined
                if (focusedCoach && !isTestCoach(focusedCoach)) {
                    setCoaches([focusedCoach])
                } else {
                    setCoaches([])
                }
                setCoachBuffer([])
                setNextCoachPage(1)
                setRawHasMoreCoaches(false)
            } else {
                let visiblePool = mode === 'append' ? [...coachBuffer] : []
                let rawPage = mode === 'append' ? nextCoachPage : 1
                let rawHasMore = mode === 'append' ? rawHasMoreCoaches : true

                while (visiblePool.length < coachesPerPage && rawHasMore) {
                    const specialtyValue = filters?.specialty ?? selectedSpecialty
                    const res = await coachService.getAllCoaches({
                        page: rawPage,
                        limit: coachesPerPage,
                        search: (filters?.search ?? searchTerm) || '',
                        specialty: specialtyValue === 'all' ? 'all' : specialtyValue
                    })

                    if (!res) {
                        rawHasMore = false
                        break
                    }

                    const rawList = Array.isArray(res.coaches) ? (res.coaches as Coach[]) : []
                    visiblePool = visiblePool.concat(rawList.filter((coach) => !isTestCoach(coach)))

                    const total = Math.max(Number(res.count || 0), 0)
                    rawHasMore = rawList.length === coachesPerPage && rawPage * coachesPerPage < total
                    rawPage += 1

                    if (rawList.length === 0) {
                        rawHasMore = false
                        break
                    }
                }

                const nextBatch = visiblePool.slice(0, coachesPerPage)
                const remainingBuffer = visiblePool.slice(coachesPerPage)

                if (mode === 'reset') {
                    setCoaches(nextBatch)
                } else if (nextBatch.length > 0) {
                    setCoaches(prev => [...prev, ...nextBatch])
                }

                setCoachBuffer(remainingBuffer)
                setNextCoachPage(rawPage)
                setRawHasMoreCoaches(rawHasMore)
            }
        } catch (error) {
            console.error('加载教练列表失败:', error)
            Taro.showToast({
                title: '加载失败',
                icon: 'none'
            })
            if (mode === 'reset') {
                setCoaches([])
                setCoachBuffer([])
                setNextCoachPage(1)
                setRawHasMoreCoaches(false)
            }
        } finally {
            setIsLoading(false)
        }
    }

    React.useEffect(() => {
        if (visibilityLoading) return
        loadSpecialties()
        void loadCoaches('reset')
    }, [visibilityLoading, visibilityStatus])

    // 混合流：根据教练列表拉取一批“服务商品”用于发现页展示
    const loadMarketHighlights = React.useCallback(async (coachList: Coach[]) => {
        if (visibilityStatus?.focusMode) {
            setMarketHighlights([])
            return
        }

        const sampleCoaches = coachList.slice(0, 8)
        if (sampleCoaches.length === 0) {
            setMarketHighlights([])
            return
        }

        try {
            setMarketLoading(true)
            const settled = await Promise.allSettled(
                sampleCoaches.map(async (coach) => {
                    const pricing = await coachService.getPricing({ coachId: coach.id })
                    const rawProducts = Array.isArray(pricing?.products) ? pricing.products : []
                    return {
                        coach,
                        products: rawProducts as MarketProduct[]
                    }
                })
            )

            const feed: MarketHighlightItem[] = []
            settled.forEach((result, idx) => {
                if (result.status !== 'fulfilled') return
                const { coach, products } = result.value
                products.slice(0, 3).forEach((product, pIdx) => {
                    const options = normalizeDurationOptions(product?.duration_options)
                    if (!options.length) return
                    const bestOption = options.find((option) => option.is_recommend) || options[0]
                    const tier = normalizeTier(product?.tier)
                    const productId = String(product?.id || '').trim()
                    if (!productId) return
                    feed.push({
                        id: `${coach.id}-${productId}-${idx}-${pIdx}`,
                        coachId: coach.id,
                        coachName: coach.name,
                        coachAvatarUrl: coach.avatar_url,
                        coachTitle: coach.bio,
                        coachFeatured: coach.is_featured,
                        productId,
                        productName: String(product?.name || '训练服务'),
                        productTier: tier,
                        productDesc: typeof product?.description === 'string' ? product.description : '',
                        durationMonths: bestOption.months,
                        price: bestOption.price,
                        recommend: !!bestOption.is_recommend
                    })
                })
            })

            const sorted = feed
                .sort((a, b) => {
                    const aFeatured = a.coachFeatured ? 1 : 0
                    const bFeatured = b.coachFeatured ? 1 : 0
                    if (aFeatured !== bFeatured) return bFeatured - aFeatured
                    return a.price - b.price
                })
                .slice(0, 12)

            setMarketHighlights(sorted)
        } catch (error) {
            console.error('加载服务商品失败:', error)
            setMarketHighlights([])
        } finally {
            setMarketLoading(false)
        }
    }, [visibilityStatus?.focusMode])

    React.useEffect(() => {
        if (visibilityLoading || visibilityStatus?.focusMode) return
        void loadMarketHighlights(coaches)
    }, [coaches, visibilityLoading, visibilityStatus?.focusMode, loadMarketHighlights])

    const loadActionHighlights = React.useCallback(async () => {
        if (visibilityStatus?.focusMode) {
            setActionHighlights([])
            return
        }

        try {
            setActionLoading(true)
            const res = await listPublicActions({
                page: 1,
                limit: 10,
                viewerActionType: 'student'
            })
            setActionHighlights((res?.actions || []).slice(0, 10))
        } catch (error) {
            console.error('加载热门动作失败:', error)
            setActionHighlights([])
        } finally {
            setActionLoading(false)
        }
    }, [visibilityStatus?.focusMode])

    React.useEffect(() => {
        if (visibilityLoading || visibilityStatus?.focusMode) return
        void loadActionHighlights()
    }, [visibilityLoading, visibilityStatus?.focusMode, loadActionHighlights])

    const loadArticleHighlights = React.useCallback(async () => {
        if (visibilityStatus?.focusMode) {
            setArticleHighlights([])
            return
        }

        try {
            setArticleLoading(true)
            const res = await knowledgeService.listCoachContents({
                limit: 8,
                offset: 0
            })
            const list = Array.isArray(res?.items) ? res.items : []
            const mapped: ArticleHighlightItem[] = list
                .map((item: any) => {
                    const content = item?.content || {}
                    const rawText = typeof content.content === 'string' ? content.content : ''
                    const summary = stripHtml(rawText).slice(0, 90)
                    return {
                        id: String(content.id || ''),
                        title: String(content.title || '未命名内容'),
                        summary: summary || '点击查看详情',
                        coachName: String(item?.coach?.name || '教练'),
                        coachAvatarUrl: item?.coach?.avatar_url || '',
                        canView: !!item?.canView,
                        createdAt: content.created_at || ''
                    }
                })
                .filter((item) => !!item.id)
                .sort((a, b) => {
                    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
                    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
                    return db - da
                })
                .slice(0, 8)

            setArticleHighlights(mapped)
        } catch (error) {
            console.error('加载健身资讯失败:', error)
            setArticleHighlights([])
        } finally {
            setArticleLoading(false)
        }
    }, [visibilityStatus?.focusMode])

    React.useEffect(() => {
        if (visibilityLoading || visibilityStatus?.focusMode) return
        void loadArticleHighlights()
    }, [visibilityLoading, visibilityStatus?.focusMode, loadArticleHighlights])

    const onSearchOrFilter = () => {
        // 专注模式下不重新加载
        if (!visibilityStatus?.focusMode) {
            void loadCoaches('reset', { search: searchTerm, specialty: selectedSpecialty })
        }
    }

    const handleCoachClick = (coachId: string) => {
        Taro.navigateTo({ url: `/discovery/coach-profile?id=${coachId}` })
    }

    const handleGoMarket = () => {
        Taro.navigateTo({ url: '/discovery/market' })
    }

    const ensureLogin = (returnTo: string) => {
        const user = authService.getCurrentUser()
        if (user?.id) return true
        Taro.showToast({ title: '请先登录', icon: 'none' })
        Taro.navigateTo({
            url: '/auth/login?returnTo=' + encodeURIComponent(returnTo)
        })
        return false
    }

    const handleBuyMarketItem = (item: MarketHighlightItem) => {
        if (!ensureLogin('/discovery/index')) return

        const query = [
            `coachId=${encodeURIComponent(item.coachId)}`,
            `productId=${encodeURIComponent(item.productId)}`,
            `months=${item.durationMonths}`
        ].join('&')

        Taro.navigateTo({
            url: `/me/payment/webview/index?${query}`
        })
    }

    const handleAddMarketToCart = async (item: MarketHighlightItem) => {
        if (!ensureLogin('/discovery/index')) return

        const actionKey = `${item.id}-${item.durationMonths}`
        if (addingMarketKey === actionKey) return
        setAddingMarketKey(actionKey)

        try {
            const res = await request({
                url: '/api/cart/add',
                method: 'POST',
                data: {
                    coachId: item.coachId,
                    coachName: item.coachName || '教练',
                    productId: item.productId,
                    productName: item.productName,
                    productTier: item.productTier,
                    durationMonths: item.durationMonths,
                    price: item.price
                }
            })
            if (!res.success) return

            Taro.showToast({
                title: '已加入购物车',
                icon: 'success'
            })
        } catch (error) {
            console.error('加入购物车失败:', error)
            Taro.showToast({
                title: '加购失败',
                icon: 'none'
            })
        } finally {
            setAddingMarketKey('')
        }
    }

    const handleActionClick = (action: PublicActionItemDto) => {
        if (!action?.id) {
            Taro.showToast({ title: '动作信息异常', icon: 'none' })
            return
        }

        const cacheKey = `action_detail_${action.id}`
        Taro.setStorageSync(cacheKey, action)
        Taro.navigateTo({
            url: `/training/action-detail/index?id=${encodeURIComponent(action.id)}`
        })
    }

    const handleAddActionToMyLib = async (action: PublicActionItemDto) => {
        if (!action?.id) return
        if (!ensureLogin('/discovery/index')) return
        if (action.isAdded) {
            Taro.showToast({ title: '已在我的动作库', icon: 'none' })
            return
        }
        if (addingActionKey === action.id) return

        setAddingActionKey(action.id)
        try {
            await addPublicToMyLib(action.id)
            Taro.showToast({ title: '已加入动作库', icon: 'success' })
            setActionHighlights((prev) => prev.map((item) => (
                item.id === action.id ? { ...item, isAdded: true } : item
            )))
        } catch (error) {
            console.error('加入动作库失败:', error)
            Taro.showToast({ title: '加入失败', icon: 'none' })
        } finally {
            setAddingActionKey('')
        }
    }

    const handleArticleClick = (article: ArticleHighlightItem) => {
        if (!article?.id) return
        Taro.navigateTo({
            url: `/content/content-detail?id=${encodeURIComponent(article.id)}`
        })
    }

    const handleSpecialtyChange = (value: string) => {
        setSelectedSpecialty(value)
        // 专注模式下不重新加载
        if (!visibilityStatus?.focusMode) {
            void loadCoaches('reset', { search: searchTerm, specialty: value })
        }
    }

    const handleLoadMore = () => {
        if (visibilityStatus?.focusMode) return
        if (hasMoreCoaches && !isLoading) {
            void loadCoaches('append')
        }
    }

    // 触底加载下一页
    useReachBottom(handleLoadMore)

    // 渲染教练卡片
    const renderCoachCard = (coach: Coach, idx: number) => (
        <View
            key={coach.id}
            className='coach-card'
            onClick={() => handleCoachClick(coach.id)}
        >
            <View className='card-content'>
                {/* 头像区 */}
                <View className='avatar-section'>
                    <View className='avatar-container'>
                        {coach.avatar_url ? (
                            <Image
                                src={coach.avatar_url}
                                mode='aspectFill'
                                className='avatar-image'
                            />
                        ) : (
                            <View className='avatar-placeholder'>
                                <Text className='avatar-text'>{coach.name.charAt(0)}</Text>
                            </View>
                        )}
                    </View>
                    {coach.is_featured && (
                        <View className='featured-badge'>
                            <View className='crown-icon'><Star size={12} /></View>
                        </View>
                    )}
                </View>

                {/* 内容区 */}
                <View className='content-section'>
                    <View className='header-row'>
                        <View className='name-section'>
                            <View className='name-row'>
                                <Text className='coach-name'>{coach.name}</Text>
                                <View className='rating-badge'>
                                    <View className='star-icon'><Star size={10} /></View>
                                    <Text className='rating-text'>
                                        {typeof coach.averageRating === 'number'
                                            ? coach.averageRating.toFixed(1)
                                            : (coach.rating?.toFixed(1) || '0.0')}
                                    </Text>
                                </View>
                            </View>
                            <Text className='coach-bio'>{coach.bio || '专业健身教练'}</Text>
                        </View>

                        {/* 价格 */}
                        {typeof coach.subscription_price_tier1 === 'number' && (
                            <View className='price-section'>
                                <Text className='price-label'>起价</Text>
                                <Text className='price-value'>¥{coach.subscription_price_tier1}</Text>
                            </View>
                        )}
                    </View>

                    {/* 专长标签 */}
                    <View className='tags-row'>
                        {coach.specialties?.slice(0, 3).map((spec, i) => (
                            <View key={i} className='tag-item'>
                                <Text className='tag-text'>{spec}</Text>
                            </View>
                        ))}
                    </View>

                    {/* 底部数据 */}
                    <View className='stats-row'>
                        <View className='stat-item'>
                            <Text className='stat-text'>{coach.studentCount || 0} 学员</Text>
                        </View>
                        <View className='stat-item'>
                            <View className='stat-icon'><Clock size={12} /></View>
                            <Text className='stat-text'>{coach.years_experience || 0} 年经验</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    )

    const renderMarketSkeleton = () => (
        <ScrollView className='market-scroll' scrollX enableFlex>
            <View className='market-scroll-inner'>
                {[1, 2, 3].map((i) => (
                    <View key={i} className='market-card market-card-skeleton'>
                        <View className='skeleton-chip' />
                        <View className='skeleton-title-md' />
                        <View className='skeleton-line-md' />
                        <View className='skeleton-line-sm' />
                        <View className='skeleton-btn-row'>
                            <View className='skeleton-btn' />
                            <View className='skeleton-btn' />
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    )

    const renderMarketSection = () => (
        <View className='market-section'>
            <View className='section-head'>
                <Text className='section-title'>服务商品</Text>
                <View className='section-more' onClick={handleGoMarket}>
                    <Text>查看更多</Text>
                </View>
            </View>

            {marketLoading ? (
                renderMarketSkeleton()
            ) : marketHighlights.length === 0 ? (
                <View className='market-empty'>
                    <Text className='market-empty-text'>暂无可展示商品，点击查看更多进入完整市场</Text>
                </View>
            ) : (
                <ScrollView className='market-scroll' scrollX enableFlex>
                    <View className='market-scroll-inner'>
                        {marketHighlights.map((item) => {
                            const actionKey = `${item.id}-${item.durationMonths}`
                            const isAdding = addingMarketKey === actionKey
                            return (
                                <View key={item.id} className='market-card'>
                                    <View className='market-card-head'>
                                        <View className={`tier-pill tier-pill-${item.productTier}`}>
                                            <Text>{tierLabel(item.productTier)}</Text>
                                        </View>
                                        <Text className='market-price'>{formatPrice(item.price)}</Text>
                                    </View>
                                    <Text className='market-product-name'>{item.productName}</Text>
                                    <Text className='market-product-desc'>
                                        {item.productDesc || `${item.durationMonths} 个月订阅服务`}
                                    </Text>
                                    <View className='market-coach-row'>
                                        <View className='market-avatar-wrap'>
                                            {item.coachAvatarUrl ? (
                                                <Image className='market-avatar' src={item.coachAvatarUrl} mode='aspectFill' />
                                            ) : (
                                                <View className='market-avatar-placeholder'>
                                                    <Text>{item.coachName?.slice(0, 1) || '教'}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View className='market-coach-meta'>
                                            <Text className='market-coach-name'>{item.coachName}</Text>
                                            <Text className='market-coach-sub'>
                                                {item.durationMonths}个月{item.recommend ? ' · 推荐' : ''}
                                            </Text>
                                        </View>
                                    </View>

                                    <View className='market-action-row'>
                                        <View className='market-btn buy' onClick={() => handleBuyMarketItem(item)}>
                                            <Text>购买</Text>
                                        </View>
                                        <View
                                            className={`market-btn cart ${isAdding ? 'market-btn-disabled' : ''}`}
                                            onClick={() => {
                                                if (!isAdding) {
                                                    void handleAddMarketToCart(item)
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
                </ScrollView>
            )}
        </View>
    )

    const renderActionSection = () => (
        <View className='feed-section'>
            <View className='section-head'>
                <Text className='section-title'>热门动作</Text>
                <View className='section-more' onClick={() => Taro.navigateTo({ url: '/training/actions' })}>
                    <Text>查看动作库</Text>
                </View>
            </View>

            {actionLoading ? (
                <ScrollView className='feed-scroll' scrollX enableFlex>
                    <View className='feed-scroll-inner'>
                        {[1, 2, 3].map((i) => (
                            <View key={i} className='feed-card action-card-skeleton'>
                                <View className='skeleton-title-md' />
                                <View className='skeleton-line-md' />
                                <View className='skeleton-line-sm' />
                                <View className='skeleton-btn-row'>
                                    <View className='skeleton-btn' />
                                    <View className='skeleton-btn' />
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : actionHighlights.length === 0 ? (
                <View className='feed-empty'>
                    <Text className='feed-empty-text'>暂无热门动作</Text>
                </View>
            ) : (
                <ScrollView className='feed-scroll' scrollX enableFlex>
                    <View className='feed-scroll-inner'>
                        {actionHighlights.map((action) => {
                            const isAdding = addingActionKey === action.id
                            return (
                                <View key={action.id} className='feed-card action-card'>
                                    <View className='action-main' onClick={() => handleActionClick(action)}>
                                        <Text className='action-name' numberOfLines={2}>{action.name || '未命名动作'}</Text>
                                        <Text className='action-desc' numberOfLines={3}>
                                            {summarizeActionDetail(action.detail)}
                                        </Text>
                                        <View className='action-meta'>
                                            <View style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Heart size={10} color='#64748b' /><Text className='action-meta-text'>{action.like_count || 0}</Text></View>
                                            <Text className='action-meta-text' numberOfLines={1}>
                                                {action.contributor?.nickname || '社区贡献'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className='action-btn-row'>
                                        <View className='mini-btn plain' onClick={() => handleActionClick(action)}>
                                            <Text>详情</Text>
                                        </View>
                                        <View
                                            className={`mini-btn primary ${(action.isAdded || isAdding) ? 'mini-btn-disabled' : ''}`}
                                            onClick={() => {
                                                if (!action.isAdded && !isAdding) {
                                                    void handleAddActionToMyLib(action)
                                                }
                                            }}
                                        >
                                            <Text>{action.isAdded ? '已加入' : isAdding ? '加入中' : '加入'}</Text>
                                        </View>
                                    </View>
                                </View>
                            )
                        })}
                    </View>
                </ScrollView>
            )}
        </View>
    )

    const renderArticleSection = () => (
        <View className='feed-section'>
            <View className='section-head'>
                <Text className='section-title'>健身资讯</Text>
                <View className='section-more' onClick={() => Taro.navigateTo({ url: '/content/knowledge' })}>
                    <Text>查看更多</Text>
                </View>
            </View>

            {articleLoading ? (
                <ScrollView className='feed-scroll' scrollX enableFlex>
                    <View className='feed-scroll-inner'>
                        {[1, 2, 3].map((i) => (
                            <View key={i} className='feed-card article-card-skeleton'>
                                <View className='skeleton-line-md' />
                                <View className='skeleton-line-md' />
                                <View className='skeleton-line-sm' />
                                <View className='skeleton-line-sm' />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : articleHighlights.length === 0 ? (
                <View className='feed-empty'>
                    <Text className='feed-empty-text'>暂无健身资讯</Text>
                </View>
            ) : (
                <ScrollView className='feed-scroll' scrollX enableFlex>
                    <View className='feed-scroll-inner'>
                        {articleHighlights.map((article) => (
                            <View key={article.id} className='feed-card article-card' onClick={() => handleArticleClick(article)}>
                                <View className='article-top'>
                                    <View className='article-coach'>
                                        <View className='article-avatar-wrap'>
                                            {article.coachAvatarUrl ? (
                                                <Image className='article-avatar' src={article.coachAvatarUrl} mode='aspectFill' />
                                            ) : (
                                                <View className='article-avatar-placeholder'>
                                                    <Text>{article.coachName.slice(0, 1)}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className='article-coach-name'>{article.coachName}</Text>
                                    </View>
                                    {!article.canView && (
                                        <View className='article-lock'><Lock size={11} color='#f59e0b' /></View>
                                    )}
                                </View>
                                <Text className='article-title' numberOfLines={2}>{article.title}</Text>
                                <Text className='article-summary' numberOfLines={3}>{article.summary}</Text>
                                <Text className='article-date'>{formatDate(article.createdAt)}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
        </View>
    )

    // 渲染骨架屏
    const renderSkeleton = () => (
        <View className='skeleton-list'>
            {[1, 2, 3].map(i => (
                <View key={i} className='skeleton-card'>
                    <View className='skeleton-avatar' />
                    <View className='skeleton-content'>
                        <View className='skeleton-line skeleton-title' />
                        <View className='skeleton-line skeleton-subtitle' />
                        <View className='skeleton-line skeleton-tags' />
                    </View>
                </View>
            ))}
        </View>
    )

    // 专注模式下显示不同的界面
    if (visibilityStatus?.focusMode) {
        return (
            <View className='discovery-page'>
                {/* 专属教练头部 */}
                <View className='page-header'>
                    <View className='header-content'>
                        <View className='title-section'>
                            <Text className='page-title'>我的专属教练</Text>
                            <Text className='page-subtitle'>
                                您通过 {visibilityStatus.focusCoachName || '教练'} 的邀请加入平台
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 教练卡片 */}
                {isLoading || visibilityLoading ? (
                    renderSkeleton()
                ) : coaches.length > 0 ? (
                    <View className='coaches-list'>
                        {coaches.map((coach, idx) => renderCoachCard(coach, idx))}
                    </View>
                ) : (
                    <View className='empty-state'>
                        <View className='empty-icon'><Eye size={40} /></View>
                        <Text className='empty-text'>教练信息加载失败</Text>
                    </View>
                )}

                {/* 底部导航栏 */}
                <BottomNav />
            </View>
        )
    }

    return (
        <View className='discovery-page'>
            {/* 头部标题区 */}
            <View className='page-header'>
                    <View className='header-content'>
                        <View className='title-section'>
                            <Text className='page-title'>发现</Text>
                            <Text className='page-subtitle'>教练、动作、资讯与服务一站发现</Text>
                        </View>
                    </View>

                {/* 搜索与筛选区域 */}
                <View className='search-section'>
                    <View className='search-container'>
                        <Input
                            className='search-input'
                            placeholder='搜索姓名或专长...'
                            value={searchTerm}
                            onInput={(e) => setSearchTerm(e.detail.value)}
                            confirmType='search'
                            onConfirm={onSearchOrFilter}
                        />
                        <View className='search-actions'>
                            {/* 筛选下拉 */}
                            <View className='filter-dropdown'>
                                <View
                                    className='filter-button'
                                    onClick={() => {
                                        Taro.showActionSheet({
                                            itemList: specialties.map(s => s.label),
                                            success: (res) => {
                                                if (res.tapIndex === 0) {
                                                    handleSpecialtyChange('all')
                                                } else {
                                                    handleSpecialtyChange(specialties[res.tapIndex].value)
                                                }
                                            }
                                        })
                                    }}
                                >
                                    <Text className='filter-icon'>筛选</Text>
                                </View>
                            </View>

                            {/* 搜索按钮 */}
                            <View className='search-button' onClick={onSearchOrFilter}>
                                <View className='search-icon'><Search size={18} color='#fff' /></View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {renderMarketSection()}
            {renderActionSection()}
            {renderArticleSection()}

            {/* 统计信息 */}
            <View className='stats-info'>
                <Text className='stats-text'>
                    {hasMoreCoaches ? `已展示 ${coaches.length} 位教练` : `当前共展示 ${coaches.length} 位教练`}
                </Text>
            </View>

            {/* 列表内容区 */}
            {isLoading && coaches.length === 0 || visibilityLoading ? (
                renderSkeleton()
            ) : coaches.length === 0 ? (
                <View className='empty-state'>
                    <View className='empty-icon'><Eye size={40} /></View>
                    <Text className='empty-text'>没有找到相关教练</Text>
                </View>
            ) : (
                <View className='coaches-list'>
                    {coaches.map((coach, idx) => renderCoachCard(coach, idx))}
                    
                    {/* 加载更多 */}
                    {hasMoreCoaches && !visibilityStatus?.focusMode && (
                        <View className='load-more' onClick={handleLoadMore}>
                            {isLoading ? (
                                <LoadingSpinner size={32} />
                            ) : (
                                <Text className='load-more-text'>加载更多</Text>
                            )}
                        </View>
                    )}

                    {/* 已加载完成提示 */}
                    {!visibilityStatus?.focusMode && coaches.length > 0 && !hasMoreCoaches && (
                        <View className='list-end-divider'>
                            <View className='list-end-line' />
                            <Text className='list-end-text'>已加载当前全部教练</Text>
                            <View className='list-end-line' />
                        </View>
                    )}
                </View>
            )}

            {/* 底部导航栏 */}
            <BottomNav />
        </View>
    )
}

export default Discovery

