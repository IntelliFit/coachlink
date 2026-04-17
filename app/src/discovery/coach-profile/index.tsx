import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import {
  fetchCoach,
  fetchAggregatedInfo,
  fetchMySubscriptions,
  fetchPricing,
  fetchContents,
  fetchQuestionnaires,
  updateSubscriptionSubscribeData
} from './service'
import type {
  CoachRow,
  GetAggregatedInfoResponseDto,
  QueryCoachSubscription,
  Product,
  CoachContentRow,
  DurationOption
} from './types'
import CoachIntro from './components/CoachIntro'
import AboutSection from './components/AboutSection'
import ContentSection from './components/ContentSection'
import PricingSection from './components/PricingSection'
import ReviewsSection from './components/ReviewsSection'
import QuestionnaireForm from '@/components/QuestionnaireForm'
import { authService } from '@/services/authService'
import { buildCoachSubscriptionPaymentStartUrl } from '@/services/paymentService'
import './index.scss'

type PageState = 'loading' | 'success' | 'error'

const TAB_ABOUT = 0
const TAB_PRICING = 1
const TAB_CONTENT = 2
const TAB_REVIEWS = 3

export default function CoachProfile() {
  const [coachId, setCoachId] = useState<string>('')
  const [coach, setCoach] = useState<CoachRow | null>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<GetAggregatedInfoResponseDto | null>(null)
  const [userSubscription, setUserSubscription] = useState<QueryCoachSubscription | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [contents, setContents] = useState<CoachContentRow[]>([])
  const [contentsTotal, setContentsTotal] = useState(0)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState(TAB_ABOUT)
  
  // 问卷相关状态
  const [questionnaireVisible, setQuestionnaireVisible] = useState(false)
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<any[]>([])
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)
  const [questionnaireSubmitting, setQuestionnaireSubmitting] = useState(false)
  // 续费模式：已订阅用户点击续费后进入，选择套餐即对当前订阅续费而非新建
  const [renewMode, setRenewMode] = useState(false)
  // 滚动锚点：点击「立即订阅」后滚动到订阅价格区域
  const [scrollIntoView, setScrollIntoView] = useState('')

  const coachDisplayName = aggregatedInfo?.coach?.name || coach?.name || ''

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

      const [pricingRes, contentRes] = await Promise.all([
        fetchPricing(id),
        fetchContents(id, 0, 10)
      ])
      let productList = pricingRes || []
      // 用户有待支付订阅时，若该订阅对应的套餐不在列表中则加入（合并 get-pricing 与订阅派生产品）
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
              duration_options: [{ months: 1, price: userSub.monthly_price ?? 0 }]
            }
          ]
        }
      }
      setProducts(productList)
      setContents(contentRes.contents || [])
      setContentsTotal(contentRes.total ?? 0)
      setPageState('success')
    } catch (e) {
      console.error('教练详情加载失败:', e)
      setErrorMsg((e as Error).message || '加载失败，请重试')
      setPageState('error')
    }
  }, [])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}
    const id = (params.id ?? params.coachId) as string
    const tabParam = params.tab as string | undefined
    const renewParam = params.renew as string | undefined
    if (id) {
      load()
      if (tabParam !== undefined && tabParam !== '') {
        const tabIndex = parseInt(tabParam, 10)
        if (!Number.isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 3) {
          setActiveTab(tabIndex)
        }
      }
      if (renewParam === 'true' || renewParam === '1') {
        setRenewMode(true)
      }
    }
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const openPaymentWebview = useCallback((params?: {
    rawUrl?: string
    productId?: string
    months?: number
    renew?: boolean
  }) => {
    const query = [
      params?.rawUrl ? `url=${encodeURIComponent(params.rawUrl)}` : '',
      !params?.rawUrl && coachId ? `coachId=${encodeURIComponent(coachId)}` : '',
      !params?.rawUrl && params?.productId ? `productId=${encodeURIComponent(params.productId)}` : '',
      !params?.rawUrl && params?.months ? `months=${params.months}` : '',
      !params?.rawUrl && params?.renew ? 'renew=1' : ''
    ]
      .filter(Boolean)
      .join('&')

    if (!query) {
      Taro.showToast({ title: '购买信息缺失，请重试', icon: 'none' })
      return
    }

    Taro.navigateTo({
      url: `/me/payment/webview/index?${query}`
    })
  }, [coachId])

  const handleSubscribe = () => {
    setActiveTab(TAB_PRICING)
    setScrollIntoView('tab-pricing-anchor')
    if (userSubscription?.status === 'waiting') {
      Taro.showToast({ title: '当前订阅正在处理中，可先查看价格与进度', icon: 'none', duration: 2200 })
    } else if (userSubscription?.status === 'active' || showRenewBtn) {
      setRenewMode(true)
      Taro.showToast({ title: '已进入续费，请选择套餐', icon: 'none', duration: 1500 })
    } else {
      Taro.showToast({ title: '已为您定位到订阅价格', icon: 'none', duration: 1500 })
    }
    setTimeout(() => setScrollIntoView(''), 600)
  }

  // 选择套餐后：
  // 1. 新购统一打开网站版购买页（小程序内 webview）
  // 2. 已有待支付订阅或续费则直接打开站内支付直达页，避免重复创建订阅
  const handleSelectProduct = async (product: Product, duration: DurationOption) => {
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
    // 已订阅且未进入续费模式：提示点击续费
    if (showRenewBtn && !renewMode) {
      Taro.showToast({
        title: '您已订阅该教练，点击上方【续费】即可延长订阅并且可以续订',
        icon: 'none',
        duration: 3000
      })
      return
    }

    // 已订阅 + 续费模式：直接用现有订阅进入站内支付直达页
    if (showRenewBtn && renewMode) {
      if (userSubscription?.id) {
        openPaymentWebview({
          rawUrl: buildCoachSubscriptionPaymentStartUrl({
            coachId,
            subscriptionId: userSubscription.id,
            amount: duration.price,
            subject: `订阅教练 ${coachDisplayName}`.trim(),
            renew: true,
            renewAdditionalWeeks: duration.months * 4
          })
        })
        return
      }
      openPaymentWebview({
        productId: product.id,
        months: duration.months,
        renew: true
      })
      return
    }

    // 已有待支付订阅且点击的是同一套餐：直接继续支付，不重复创建
    if (
      (userSubscription?.status === 'inactive' || userSubscription?.status === 'pending_payment') &&
      userSubscription?.id &&
      product.id === userSubscription.product_id
    ) {
      openPaymentWebview({
        rawUrl: buildCoachSubscriptionPaymentStartUrl({
          coachId,
          subscriptionId: userSubscription.id,
          amount: duration.price,
          subject: `订阅教练 ${coachDisplayName}`.trim(),
          renew: false
        })
      })
      return
    }

    openPaymentWebview({
      productId: product.id,
      months: duration.months
    })
  }

  const handleGeneratePlan = () => {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }
    const user = authService.getCurrentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.navigateTo({ url: `/auth/login?returnTo=${encodeURIComponent(`/discovery/coach-profile?id=${coachId}`)}` })
      return
    }
    Taro.navigateTo({ url: `/discovery/generate-plan?coachId=${coachId}` })
  }

  const handleContentItem = (content: CoachContentRow) => {
    if (content?.id) {
      Taro.navigateTo({ url: `/content/content-detail?id=${content.id}` })
    } else {
      Taro.showToast({ title: '无法打开该内容', icon: 'none' })
    }
  }

  // 打开问卷填写对话框
  const handleOpenQuestionnaire = async () => {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

    setQuestionnaireLoading(true)
    setQuestionnaireVisible(true)
    
    try {
      const questions = await fetchQuestionnaires(coachId)
      if (questions && questions.length > 0) {
        setQuestionnaireQuestions(questions)
        
        // 如果有现有订阅数据，预填充答案
        if (userSubscription?.subscribe_data) {
          // subscribe_data 已经是答案格式
        }
      } else {
        Taro.showToast({ title: '该教练暂未配置问卷', icon: 'none' })
        setQuestionnaireVisible(false)
      }
    } catch (e: any) {
      console.error('获取问卷失败:', e)
      Taro.showToast({ title: e.message || '获取问卷失败', icon: 'none' })
      setQuestionnaireVisible(false)
    } finally {
      setQuestionnaireLoading(false)
    }
  }

  // 提交问卷
  const handleSubmitQuestionnaire = async (answers: any[]) => {
    try {
      setQuestionnaireSubmitting(true)
      if (userSubscription?.id) {
        const success = await updateSubscriptionSubscribeData(userSubscription.id, answers)
        if (success) {
          Taro.showToast({ title: '问卷提交成功', icon: 'success' })
          setQuestionnaireVisible(false)
          const user = authService.getCurrentUser()
          if (user?.id) {
            const subs = await fetchMySubscriptions(user.id)
            const sub = subs.find((s) => s.coach_id === coachId) || null
            setUserSubscription(sub)
          }
        } else {
          Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: '请先完成订阅后再填写问卷', icon: 'none' })
      }
    } catch (e: any) {
      console.error('提交问卷失败:', e)
      Taro.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      setQuestionnaireSubmitting(false)
    }
  }

  if (pageState === 'loading') {
    return (
      <View className='coach-profile-page'>
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
      <View className='coach-profile-page'>
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
  const reviewCount = aggregatedInfo?.reviewCount ?? 0

  const showRenewBtn = ['active', 'expired', 'near_expiry'].includes(userSubscription?.status || '')
  const hasPendingPayment =
    userSubscription &&
    (userSubscription.status === 'inactive' ||
      userSubscription.status === 'pending_payment')

  const handleContinuePendingPayment = () => {
    if (userSubscription?.id && userSubscription.monthly_price != null) {
      openPaymentWebview({
        rawUrl: buildCoachSubscriptionPaymentStartUrl({
          coachId,
          subscriptionId: userSubscription.id,
          amount: userSubscription.monthly_price,
          subject: `订阅教练 ${displayCoach.name || ''}`.trim(),
          renew: false
        })
      })
      return
    }
    openPaymentWebview()
  }

  const tabs = [
    { index: TAB_ABOUT, label: '关于教练' },
    { index: TAB_PRICING, label: '订阅价格' },
    { index: TAB_CONTENT, label: `教学内容(${contentsTotal})` },
    { index: TAB_REVIEWS, label: `学员评价(${reviewCount})` }
  ]

  return (
    <View className='coach-profile-page'>
      <ScrollView
        scrollY
        className='scroll-wrap'
        style={{ height: '100vh' }}
        scrollIntoView={scrollIntoView}
        scrollWithAnimation
        scrollIntoViewAlignment='start'
      >
        <View style={{ paddingBottom: '100px' }}>
        {hasPendingPayment && (
          <View className='pending-payment-banner' onClick={handleContinuePendingPayment}>
            <Text className='banner-text'>您有待支付的订阅，点击继续完成购买</Text>
          </View>
        )}
        <CoachIntro
          coach={displayCoach}
          aggregatedInfo={aggregatedInfo}
          userSubscription={userSubscription}
        />

        <View id='tab-pricing-anchor' className='tab-wrap'>
          <View className='tab-bar'>
            {tabs.map((t) => (
              <View
                key={t.index}
                className={`tab-item ${activeTab === t.index ? 'tab-item-active' : ''}`}
                onClick={() => setActiveTab(t.index)}
              >
                <Text>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={`tab-panel ${activeTab === TAB_ABOUT ? 'tab-panel-active' : ''}`}>
          <AboutSection coach={displayCoach} />
        </View>
        <View className={`tab-panel ${activeTab === TAB_PRICING ? 'tab-panel-active' : ''}`}>
          <PricingSection
            products={products}
            onSelectProduct={handleSelectProduct}
            userSubscription={userSubscription}
            renewMode={renewMode}
          />
        </View>
        <View className={`tab-panel ${activeTab === TAB_CONTENT ? 'tab-panel-active' : ''}`}>
          <ContentSection
            contents={contents}
            total={contentsTotal}
            onItemClick={handleContentItem}
          />
        </View>
        <View className={`tab-panel ${activeTab === TAB_REVIEWS ? 'tab-panel-active' : ''}`}>
          <ReviewsSection reviewCount={reviewCount} />
        </View>
        </View>
      </ScrollView>

      {!isOwnProfile && (
        <View className='fixed-cta'>
          {userSubscription?.status === 'active' && (
            <>
              <View className='generate-plan-btn' onClick={handleGeneratePlan}>
                <Text>智能生成计划</Text>
              </View>
              <View className='questionnaire-btn' onClick={handleOpenQuestionnaire}>
                <Text>填写/更新训练需求问卷</Text>
              </View>
            </>
          )}
          <View className='fixed-cta-btn' onClick={handleSubscribe}>
            <Text>
              {showRenewBtn
                ? '续费'
                : userSubscription?.status === 'waiting'
                  ? '查看订阅进度'
                  : '立即订阅 / 查看价格'}
            </Text>
          </View>
        </View>
      )}

      {/* 问卷填写对话框 */}
      <QuestionnaireForm
        visible={questionnaireVisible}
        onHide={() => setQuestionnaireVisible(false)}
        questions={questionnaireQuestions}
        onSubmit={handleSubmitQuestionnaire}
        loading={questionnaireLoading}
        existingAnswers={userSubscription?.subscribe_data as any}
      />
    </View>
  )
}
