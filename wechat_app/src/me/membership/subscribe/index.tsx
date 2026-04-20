import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { request } from '@/utils/request'
import './index.scss'
import { Check, Notice } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type MembershipTier = 'free' | 'basic' | 'premium' | 'trial'

interface MembershipData {
  tier: MembershipTier
}

interface CouponData {
  id: string
}

interface PlanItem {
  id: string
  name: string
  price: string
  duration: string
  features: string[]
  tab: 'membership' | 'addon'
  tier?: MembershipTier
}

const PLAN_ITEMS: PlanItem[] = [
  {
    id: 'monthly_basic',
    name: '基础会员',
    price: '19.9',
    duration: '月',
    tab: 'membership',
    tier: 'basic',
    features: ['每月 10 次智能计划生成', '1GB 云存储空间', '无限历史数据查询']
  },
  {
    id: 'monthly_premium',
    name: '高级会员',
    price: '39.9',
    duration: '月',
    tab: 'membership',
    tier: 'premium',
    features: ['智能计划生成不限次数', '5GB 云存储空间', '专属高级训练分析']
  },
  {
    id: 'ai_pack_basic',
    name: 'AI 导入加油包',
    price: '2.0',
    duration: '3次',
    tab: 'addon',
    features: ['当月度配额不足时可补充', '购买后立即到账', '永久有效']
  },
  {
    id: 'storage_pack_basic',
    name: '存储扩容包',
    price: '9.9',
    duration: '1GB',
    tab: 'addon',
    features: ['扩展视频/训练记录空间', '购买后立即扩容', '永久有效']
  }
]

function MembershipSubscribe() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [currentTier, setCurrentTier] = useState<MembershipTier>('free')
  const [couponCount, setCouponCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'membership' | 'addon'>('membership')

  useEffect(() => {
    const tab = router.params?.tab as string
    if (tab === 'addon') {
      setActiveTab('addon')
    }
  }, [router.params])

  useDidShow(() => {
    loadPlans()
  })

  const loadPlans = async () => {
    try {
      setLoading(true)
      const [statusRes, couponRes] = await Promise.all([
        request<MembershipData>({
          url: '/api/membership/get-status',
          method: 'POST',
          data: {}
        }),
        request<CouponData[]>({
          url: '/api/membership/list-coupons',
          method: 'POST',
          data: {}
        })
      ])

      if (statusRes.success && statusRes.data?.tier) {
        setCurrentTier(statusRes.data.tier)
      }
      if (couponRes.success && Array.isArray(couponRes.data)) {
        setCouponCount(couponRes.data.length)
      }

      setPlans(PLAN_ITEMS.filter((item) => item.tab === activeTab))
    } catch (error) {
      console.error('加载订阅计划失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPlans(PLAN_ITEMS.filter((item) => item.tab === activeTab))
  }, [activeTab])

  const handleSubscribe = (plan: PlanItem) => {
    if (plan.tier && (currentTier === plan.tier || (currentTier === 'trial' && plan.tier === 'premium'))) {
      Taro.showToast({
        title: '当前已是该会员等级',
        icon: 'none'
      })
      return
    }

    const tab = plan.tab === 'addon' ? 'addon' : 'membership'
    const webviewUrl = `/me/payment/webview/index?target=membership&tab=${tab}&productKey=${plan.id}&autoPurchase=1`
    Taro.navigateTo({
      url: webviewUrl
    })
  }

  return (
    <View className='membership-subscribe-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='subscribe-status'>
            <Text className='subscribe-status-text'>
              当前等级：{currentTier === 'premium' ? '高级会员' : currentTier === 'basic' ? '基础会员' : currentTier === 'trial' ? '试用会员' : '免费用户'}
            </Text>
          </View>

          {/* Tab 切换 */}
          <View className='tab-switcher'>
            <View
              className={`tab-item ${activeTab === 'membership' ? 'active' : ''}`}
              onClick={() => setActiveTab('membership')}
            >
              <Text>会员套餐</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'addon' ? 'active' : ''}`}
              onClick={() => setActiveTab('addon')}
            >
              <Text>加油包</Text>
            </View>
          </View>

          {couponCount > 0 && (
            <View className='coupon-tip'>
              <Text>您有 {couponCount} 张可用优惠券，进入购买页后可按网页端流程继续使用。</Text>
            </View>
          )}

          {loading ? (
            <View className='loading-wrap'>
              <LoadingSpinner size={48} />
            </View>
          ) : (
            <View className='plans-list'>
              {plans.length === 0 ? (
                <View className='empty-state'>
                  <Text className='empty-text'>暂无可用套餐</Text>
                  <Text className='empty-hint'>请稍后刷新重试</Text>
                </View>
              ) : (
                plans.map((plan) => (
                  <View key={plan.id} className='plan-card'>
                    <View className='plan-header'>
                      <View className='plan-name-wrap'>
                        <Text className='plan-name'>{plan.name}</Text>
                        {plan.tier && (currentTier === plan.tier || (currentTier === 'trial' && plan.tier === 'premium')) && (
                          <Text className='plan-badge'>当前方案</Text>
                        )}
                      </View>
                      <View className='plan-price'>
                        <Text className='price-symbol'>¥</Text>
                        <Text className='price-amount'>{plan.price}</Text>
                        <Text className='price-unit'>/{plan.duration}</Text>
                      </View>
                    </View>
                    <View className='plan-features'>
                      {plan.features?.map((feature: string, idx: number) => (
                        <View key={idx} className='feature-item'>
                          <View className='feature-icon'><Check /></View>
                          <Text className='feature-text'>{feature}</Text>
                        </View>
                      ))}
                    </View>
                    <View 
                      className='subscribe-btn'
                      onClick={() => handleSubscribe(plan)}
                    >
                      <Text>立即购买</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View className='notice-box'>
            <View className='notice-text'>
              <Notice /> 提示：支付会在小程序内打开与网站一致的购买页，当前优先支持支付宝完成支付
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default MembershipSubscribe
