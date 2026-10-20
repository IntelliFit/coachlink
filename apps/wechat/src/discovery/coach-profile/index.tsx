import { useState, useCallback, useEffect } from 'react'
import { WECHAT_COACH_PURCHASE_PAUSED, WECHAT_PURCHASE_PAUSED_MESSAGE } from '@coachlink/core'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import {
  fetchCoach,
  fetchAggregatedInfo,
  fetchMySubscriptions,
  fetchPricing,
  fetchContents,
  fetchPublicReviews,
  fetchQuestionnaires,
  createSubscription,
  createCoachWechatPayment,
  requestCoachWechatPayment
} from './service'
import type {
  CoachRow,
  GetAggregatedInfoResponseDto,
  QueryCoachSubscription,
  Product,
  CoachContentRow,
  PublicCoachReview,
  DurationOption
} from './types'
import CoachIntro from './components/CoachIntro'
import AboutSection from './components/AboutSection'
import ContentSection from './components/ContentSection'
import PricingSection from './components/PricingSection'
import ReviewsSection from './components/ReviewsSection'
import { authService } from '@/services/authService'
import { previewCoachPackageSwitch } from '@/services/paymentService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { ClButton, ClTabs } from '@/components/ui'

type PageState = 'loading' | 'success' | 'error'

const IS_DEV = process.env.NODE_ENV === 'development'

const TAB_ABOUT = 0
const TAB_PRICING = 1
const TAB_CONTENT = 2
const TAB_REVIEWS = 3

export default function CoachProfile() {
  const { effectiveTheme } = useTheme()
  const [coachId, setCoachId] = useState<string>('')
  const [coach, setCoach] = useState<CoachRow | null>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<GetAggregatedInfoResponseDto | null>(null)
  const [userSubscription, setUserSubscription] = useState<QueryCoachSubscription | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [contents, setContents] = useState<CoachContentRow[]>([])
  const [contentsTotal, setContentsTotal] = useState(0)
  const [reviews, setReviews] = useState<PublicCoachReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState(TAB_ABOUT)
  const [renewMode, setRenewMode] = useState(false)
  const [scrollIntoView, setScrollIntoView] = useState('')
  const [autoSelectRequest, setAutoSelectRequest] = useState<{
    productId: string
    months: number
  } | null>(null)

  const coachDisplayName = aggregatedInfo?.coach?.name || coach?.name || ''
  const receivingAccountReady = (aggregatedInfo?.coach?.huifu_open_status || coach?.huifu_open_status) === 'opened'

  const load = useCallback(async () => {
    const instance = Taro.getCurrentInstance()
    const id = (instance.router?.params?.id ?? instance.router?.params?.coachId) as string
    if (!id) {
      setErrorMsg('缺少教练 ID')
      setPageState('error')
      return
    }
    setCoachId(id)

    setPageState('loading')
    setReviewsLoading(true)
    setReviewsLoaded(false)
    setErrorMsg('')
    try {
      const [coachRes, aggRes] = await Promise.all([
        fetchCoach(id),
        fetchAggregatedInfo(id)
      ])
      if (!coachRes) {
        setErrorMsg('获取教练信息失败')
        setPageState('error')
        return
      }
      setCoach(coachRes)
      setAggregatedInfo(aggRes || null)

      const user = authService.getCurrentUser()
      let userSub: QueryCoachSubscription | null = null
      if (user?.id) {
        const subs = await fetchMySubscriptions(user.id)
        userSub = subs.find((s) => s.coach_id === id) || null
        setUserSubscription(userSub)
      } else {
        setUserSubscription(null)
      }

      const [pricingRes, contentRes, reviewsRes] = await Promise.all([
        WECHAT_COACH_PURCHASE_PAUSED ? Promise.resolve([]) : fetchPricing(id),
        fetchContents(id, 0, 10),
        fetchPublicReviews(id)
      ])
      let productList = pricingRes || []
      if (userSub?.product_id && userSub?.product_name && (userSub.status === 'inactive' || userSub.status === 'waiting')) {
        const hasSubProduct = productList.some((p: Product) => p.id === userSub!.product_id)
        if (!hasSubProduct) {
          productList = [
            ...productList,
            {
              id: userSub.product_id,
              tier: userSub.product_tier || 'basic',
              type: 'single',
              name: userSub.product_name,
              description: userSub.status === 'inactive' ? '待支付' : '待确认',
              duration_options: [{ months: 1, price: Number(userSub.monthly_price ?? 0) / 100 }]
            }
          ]
        }
      }
      setProducts(productList)
      setContents(contentRes.contents || [])
      setContentsTotal(contentRes.total ?? 0)
      setReviews(reviewsRes || [])
      setReviewsLoaded(reviewsRes !== null)
      setPageState('success')
    } catch (e) {
      console.error('教练详情加载失败:', e)
      setErrorMsg((e as Error).message || '加载失败，请重试')
      setPageState('error')
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}
    const id = (params.id ?? params.coachId) as string
    const tabParam = params.tab as string | undefined
    const renewParam = params.renew as string | undefined
    const autoSubscribeParam = params.autoSubscribe as string | undefined
    const autoSubscribeToken = params.autoSubscribeToken as string | undefined
    const productIdParam = params.productId as string | undefined
    const monthsParam = params.months as string | undefined
    if (id) {
      load()
      if (tabParam !== undefined && tabParam !== '') {
        const tabIndex = parseInt(tabParam, 10)
        if (!Number.isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 3) {
          setActiveTab(WECHAT_COACH_PURCHASE_PAUSED && tabIndex === TAB_PRICING ? TAB_ABOUT : tabIndex)
        }
      }
      if (!WECHAT_COACH_PURCHASE_PAUSED && (renewParam === 'true' || renewParam === '1')) {
        setRenewMode(true)
      }
      if (!WECHAT_COACH_PURCHASE_PAUSED && (autoSubscribeParam === 'true' || autoSubscribeParam === '1') && productIdParam) {
        const consumeKey = autoSubscribeToken
          ? `coach-profile-auto-subscribe-consumed:${autoSubscribeToken}`
          : ''
        const consumed = consumeKey ? Taro.getStorageSync(consumeKey) : ''

        if (!consumed) {
          if (consumeKey) {
            Taro.setStorageSync(consumeKey, '1')
          }
          const months = Number(monthsParam)
          setAutoSelectRequest({
            productId: productIdParam,
            months: Number.isFinite(months) ? months : 0
          })
        } else {
          setAutoSelectRequest(null)
        }
      } else {
        setAutoSelectRequest(null)
      }
    }
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const navigateToPaymentWaiting = useCallback((params: {
    orderId: string
    amount: number
    initialStatus?: 'cancelled' | 'failed'
  }) => {
    const query = [
      `orderId=${encodeURIComponent(params.orderId)}`,
      `amount=${encodeURIComponent(String(params.amount))}`,
      coachId ? `coachId=${encodeURIComponent(coachId)}` : '',
      'provider=huifu',
      params.initialStatus ? `initialStatus=${encodeURIComponent(params.initialStatus)}` : ''
    ].filter(Boolean).join('&')

    Taro.navigateTo({ url: `/me/payment-waiting/index?${query}` })
  }, [coachId])

  const navigateToQuestionnairePage = useCallback((params: {
    mode: 'edit' | 'prepay'
    product?: Product
    duration?: DurationOption
    existingAnswers?: any[]
  }) => {
    const query = [
      `coachId=${encodeURIComponent(coachId)}`,
      `mode=${encodeURIComponent(params.mode)}`,
      coachDisplayName ? `coachName=${encodeURIComponent(coachDisplayName)}` : '',
      userSubscription?.id ? `subscriptionId=${encodeURIComponent(userSubscription.id)}` : ''
    ]

    if (params.mode === 'prepay' && params.product && params.duration) {
      query.push(`productId=${encodeURIComponent(params.product.id)}`)
      query.push(`productName=${encodeURIComponent(params.product.name)}`)
      query.push(`productTier=${encodeURIComponent(params.product.tier)}`)
      query.push(`price=${encodeURIComponent(String(params.duration.price))}`)
      query.push(`months=${encodeURIComponent(String(params.duration.months))}`)
    }

    if (params.mode === 'edit' && params.existingAnswers) {
      const answersKey = `coach-questionnaire-${Date.now()}`
      Taro.setStorageSync(answersKey, params.existingAnswers)
      query.push(`answersKey=${encodeURIComponent(answersKey)}`)
    }

    Taro.navigateTo({ url: `/discovery/coach-questionnaire?${query.filter(Boolean).join('&')}` })
  }, [coachDisplayName, coachId, userSubscription?.id])

  const ensureWechatOpenid = useCallback(async () => {
    const user = authService.getCurrentUser()
    if (user?.wechat_openid) return true
    const result = await authService.bindWechatOpenid()
    if (!result.success) {
      Taro.showToast({ title: result.message || '绑定微信失败，请使用微信快捷登录', icon: 'none' })
      return false
    }
    return true
  }, [])

  const startCoachWechatPayment = useCallback(async (params: {
    subscriptionId: string
    amount?: number
    renew?: boolean
    renewAdditionalWeeks?: number
    testAmountFen?: number
    productId?: string
    months?: number
    packageSwitch?: boolean
  }) => {
    if (WECHAT_COACH_PURCHASE_PAUSED) {
      Taro.showToast({ title: WECHAT_PURCHASE_PAUSED_MESSAGE, icon: 'none' })
      return
    }
    if (params.packageSwitch && params.productId && params.months) {
      await previewCoachPackageSwitch({ coachId, subscriptionId: params.subscriptionId, productId: params.productId, months: params.months })
    }
    const ok = await ensureWechatOpenid()
    if (!ok) return

    const payment = await createCoachWechatPayment({
      coachId,
      subscriptionId: params.subscriptionId,
      amount: params.amount,
      renew: params.renew,
      renewAdditionalWeeks: params.renewAdditionalWeeks,
      testAmountFen: params.testAmountFen,
      productId: params.productId,
      months: params.months,
      subject: `订阅教练 ${coachDisplayName}`.trim()
    })

    if (!payment || !('orderId' in payment)) {
      Taro.showToast({ title: (payment as any)?.message || '创建支付单失败，请稍后重试', icon: 'none' })
      return
    }

    if (params.packageSwitch && payment.packageSwitchPolicy !== 'after_current') {
      throw new Error('支付服务尚未支持接续套餐，请稍后重试')
    }
    const paymentResult = await requestCoachWechatPayment(payment.paymentParams)
    navigateToPaymentWaiting({
      orderId: payment.orderId,
      amount: payment.amount,
      initialStatus: paymentResult.status === 'success' ? undefined : paymentResult.status
    })
  }, [coachDisplayName, coachId, navigateToPaymentWaiting, ensureWechatOpenid])

  const handleSubscribe = () => {
    if (WECHAT_COACH_PURCHASE_PAUSED) {
      Taro.navigateTo({ url: '/me/my-coaches/index' })
      return
    }
    setActiveTab(TAB_PRICING)
    setScrollIntoView('tab-pricing-anchor')
    if (userSubscription?.status === 'waiting') {
      Taro.showToast({ title: '当前订阅正在处理中，可先查看价格与进度', icon: 'none', duration: 2200 })
    } else {
      Taro.showToast({ title: '已为您定位到订阅价格', icon: 'none', duration: 1500 })
    }
    setTimeout(() => setScrollIntoView(''), 600)
  }

  const handleEnterRenewMode = () => {
    if (WECHAT_COACH_PURCHASE_PAUSED) return
    setActiveTab(TAB_PRICING)
    setScrollIntoView('tab-pricing-anchor')
    setRenewMode(true)
    Taro.showToast({ title: '已进入续费，请选择套餐', icon: 'none', duration: 1500 })
    setTimeout(() => setScrollIntoView(''), 600)
  }

  const handleStartTestRenew = async () => {
    if (WECHAT_COACH_PURCHASE_PAUSED) return
    if (!IS_DEV) return
    if (!userSubscription?.id) {
      Taro.showToast({ title: '缺少当前订阅，无法测试续费', icon: 'none' })
      return
    }
    await startCoachWechatPayment({
      subscriptionId: userSubscription.id,
      amount: 1,
      renew: true,
      renewAdditionalWeeks: 4,
      testAmountFen: 100
    })
  }

  const handleSelectProduct = async (product: Product, duration: DurationOption) => {
    if (WECHAT_COACH_PURCHASE_PAUSED) return
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.navigateTo({ url: '/auth/login?returnTo=' + encodeURIComponent(`/discovery/coach-profile?id=${coachId}&tab=1`) })
      return
    }
    if (userSubscription?.status === 'waiting') {
      Taro.showToast({
        title: '当前订阅正在处理中，请先查看订阅进度',
        icon: 'none',
        duration: 2500
      })
      return
    }
    const isDifferentPackage = showRenewBtn && product.id !== userSubscription?.product_id
    if (showRenewBtn && !renewMode && !isDifferentPackage) {
      Taro.showToast({
        title: '您已订阅该教练，点击【续费】即可延长订阅并且可以续订',
        icon: 'none',
        duration: 3000
      })
      return
    }

    if (!receivingAccountReady) {
      Taro.showToast({
        title: '教练汇付收款账户尚未开通，暂时不能购买/续费',
        icon: 'none',
        duration: 2500
      })
      return
    }

    if (showRenewBtn && (renewMode || isDifferentPackage)) {
      if (userSubscription?.id) {
        try {
          if (isDifferentPackage) {
            const { confirm } = await Taro.showModal({ title: '购买接续套餐',
              content: `${product.name}，${duration.months}个月，¥${duration.price}。旧套餐权益用完后生效，当前训练和历史记录保留。`,
              confirmText: '继续购买', confirmColor: '#CF6D4E' })
            if (!confirm) return
          }
          await startCoachWechatPayment({ subscriptionId: userSubscription.id, amount: duration.price,
            renew: true, renewAdditionalWeeks: duration.months * 4,
            productId: product.id, months: duration.months, packageSwitch: isDifferentPackage })
        } catch (error: any) {
          Taro.showToast({ title: error?.message || '无法购买套餐，请稍后重试', icon: 'none' })
        }
        return
      }
      return
    }

    try {
      const questions = await fetchQuestionnaires(coachId)
      if (questions && questions.length > 0) {
        navigateToQuestionnairePage({
          mode: 'prepay',
          product,
          duration
        })
      } else {
        const createdSubscription = await createSubscription({
          coachId,
          tier: product.tier === 'basic' ? 1 : product.tier === 'standard' ? 2 : 3,
          monthlyPrice: duration.price,
          status: 'inactive',
          subscribeData: [],
          productId: product.id,
          productName: product.name,
          productTier: product.tier,
          subscribedWeeks: duration.months * 4
        })
        if (!createdSubscription?.id) {
          throw new Error('创建订阅失败')
        }
        setUserSubscription(createdSubscription)
        await startCoachWechatPayment({
          subscriptionId: createdSubscription.id
        })
      }
    } catch (e: any) {
      console.error('拉起订阅流程失败:', e)
      Taro.showToast({ title: e?.message || '拉起订阅流程失败', icon: 'none' })
    }
  }

  const handleContentItem = (content: CoachContentRow) => {
    if (content?.id) {
      Taro.navigateTo({ url: `/content/content-detail?id=${content.id}` })
    } else {
      Taro.showToast({ title: '无法打开该内容', icon: 'none' })
    }
  }

  const handleOpenQuestionnaire = async () => {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

    if (!userSubscription?.id) {
      Taro.showToast({ title: '请先完成订阅后再填写问卷', icon: 'none' })
      return
    }

    navigateToQuestionnairePage({
      mode: 'edit',
      existingAnswers: (userSubscription?.subscribe_data as any[]) || []
    })
  }

  const showRenewBtn = ['active', 'expired', 'near_expiry'].includes(userSubscription?.status || '')
  const hasPendingPayment =
    userSubscription &&
    (userSubscription.status === 'inactive' ||
      userSubscription.status === 'pending_payment')

  useEffect(() => {
    if (!autoSelectRequest || pageState !== 'success' || products.length === 0) return

    const targetProduct = products.find((product) => product.id === autoSelectRequest.productId)
    if (!targetProduct) {
      Taro.showToast({ title: '未找到对应套餐，请重新选择', icon: 'none' })
      setAutoSelectRequest(null)
      return
    }

    const targetDuration =
      targetProduct.duration_options.find((option) => option.months === autoSelectRequest.months) ||
      targetProduct.duration_options[0]

    if (!targetDuration) {
      Taro.showToast({ title: '未找到对应时长，请重新选择', icon: 'none' })
      setAutoSelectRequest(null)
      return
    }

    setAutoSelectRequest(null)
    void handleSelectProduct(targetProduct, targetDuration)
  }, [autoSelectRequest, pageState, products])

  if (pageState === 'loading') {
    return (
      <View className={`coach-profile-page theme-${effectiveTheme}`}>
        <View className='skeleton-wrap'>
          <View className='skeleton-header'>
            <View className='skeleton-avatar' />
            <View className='skeleton-meta'>
              <View className='skeleton-line' style={{ width: '60%' }} />
              <View className='skeleton-line skeleton-line-sm' />
            </View>
          </View>
          <View className='skeleton-line' />
          <View className='skeleton-line' />
          <View className='skeleton-line' style={{ width: '80%' }} />
        </View>
      </View>
    )
  }

  if (pageState === 'error') {
    return (
      <View className={`coach-profile-page theme-${effectiveTheme}`}>
        <View className='error-wrap'>
          <Text className='error-text'>{errorMsg}</Text>
          <View className='btn-retry' onClick={load}>
            <Text>重试</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!coach) return null

  const displayCoach = aggregatedInfo?.coach || coach
  const isOwnProfile = false
  const reviewCount = reviewsLoaded ? reviews.length : (aggregatedInfo?.reviewCount ?? 0)

  const handleContinuePendingPayment = () => {
    if (userSubscription?.id) {
      void startCoachWechatPayment({
        subscriptionId: userSubscription.id
      })
      return
    }
    Taro.showToast({ title: '缺少待支付订阅', icon: 'none' })
  }

  const tabs = [
    { key: String(TAB_ABOUT), label: '介绍' },
    ...(!WECHAT_COACH_PURCHASE_PAUSED ? [{ key: String(TAB_PRICING), label: '方案', count: products.length || undefined }] : []),
    { key: String(TAB_CONTENT), label: '专栏', count: (aggregatedInfo?.contentCount ?? contentsTotal) || undefined },
    { key: String(TAB_REVIEWS), label: '评价', count: reviewCount || undefined }
  ]

  // Lowest 1-month (4-week) price across packages, for the bottom bar.
  const monthlyPrices = products.reduce<DurationOption[]>((all, product) => all.concat(product.duration_options || []), [])
    .filter((option) => option.months === 1 && Number(option.price) > 0)
    .map((option) => Number(option.price))
  const fromPrice = monthlyPrices.length > 0 ? Math.min(...monthlyPrices) : null
  const ctaLabel = WECHAT_COACH_PURCHASE_PAUSED
    ? '查看已有教练关系'
    : userSubscription?.status === 'active'
      ? '查看订阅'
      : userSubscription?.status === 'waiting'
        ? '查看订阅进度'
        : '选择方案'

  return (
    <View className={`coach-profile-page theme-${effectiveTheme} ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
      <ScrollView
        scrollY
        className='scroll-wrap'
        style={{ height: '100vh' }}
        scrollIntoView={scrollIntoView}
        scrollWithAnimation
        scrollIntoViewAlignment='start'
      >
        <View style={{ paddingBottom: '100px' }}>
          {!WECHAT_COACH_PURCHASE_PAUSED && hasPendingPayment && (
            <View className='pending-payment-banner' onClick={handleContinuePendingPayment}>
              <Text className='banner-text'>您有待支付的订阅，点击继续完成购买</Text>
            </View>
          )}
          <CoachIntro
            coach={displayCoach}
            aggregatedInfo={aggregatedInfo}
            userSubscription={userSubscription}
            reviewCount={reviewCount}
            onOpenQuestionnaire={handleOpenQuestionnaire}
          />

          <View id='tab-pricing-anchor' className='cp-tabs'>
            <ClTabs items={tabs} activeKey={String(activeTab)} onChange={(key) => setActiveTab(Number(key))} />
          </View>

          <View className={`tab-panel ${activeTab === TAB_ABOUT ? 'tab-panel-active' : ''}`}>
            <AboutSection coach={displayCoach} />
          </View>
          {!WECHAT_COACH_PURCHASE_PAUSED && <View className={`tab-panel ${activeTab === TAB_PRICING ? 'tab-panel-active' : ''}`}>
            <PricingSection
              products={products}
              onSelectProduct={handleSelectProduct}
              userSubscription={userSubscription}
              renewMode={renewMode}
              receivingAccountReady={receivingAccountReady}
              onEnterRenewMode={handleEnterRenewMode}
              onStartTestRenew={IS_DEV ? handleStartTestRenew : undefined}
            />
          </View>}
          <View className={`tab-panel ${activeTab === TAB_CONTENT ? 'tab-panel-active' : ''}`}>
            <ContentSection
              contents={contents}
              total={contentsTotal}
              onItemClick={handleContentItem}
              lockedForGuestCount={authService.getAuthSession({ normalize: true }).isAuthenticated ? 0 : (aggregatedInfo?.contentCount ?? 0)}
              onLogin={() => {
                Taro.navigateTo({ url: authService.buildLoginUrl(`/discovery/coach-profile?id=${coachId}`) }).catch(() => undefined)
              }}
            />
          </View>
          <View className={`tab-panel ${activeTab === TAB_REVIEWS ? 'tab-panel-active' : ''}`}>
            <ReviewsSection reviews={reviews} loading={reviewsLoading} loadFailed={!reviewsLoaded} />
          </View>
        </View>
      </ScrollView>

      {!isOwnProfile && (
        <View className='cp-bar'>
          <View className='cp-bar__copy'>
            {WECHAT_COACH_PURCHASE_PAUSED ? (
              <Text className='cp-bar__hint'>可从“我的教练”查看已有服务</Text>
            ) : fromPrice !== null && !userSubscription?.status ? (
              <>
                <Text className='cp-bar__price cl-num'>¥{fromPrice} 起<Text className='cp-bar__unit'> / 4 周</Text></Text>
                <Text className='cp-bar__hint'>按训练日计次，开练才计</Text>
              </>
            ) : (
              <Text className='cp-bar__hint'>{coachDisplayName ? `${coachDisplayName}的训练方案` : '教练方案'}</Text>
            )}
          </View>
          <ClButton className='cp-bar__btn' onClick={handleSubscribe}>{ctaLabel}</ClButton>
        </View>
      )}
    </View>
  )
}
