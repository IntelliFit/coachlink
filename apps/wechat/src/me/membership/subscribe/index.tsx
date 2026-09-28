import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { request } from '@/utils/request'
import { authService } from '@/services/authService'
import {
  createMembershipWechatPayment,
  requestWechatPayment
} from '@/services/paymentService'
import './index.scss'
import { Check, Notice } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

type MembershipTier = 'free' | 'basic' | 'premium' | 'trial'

interface MembershipData {
  tier: MembershipTier
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
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [currentTier, setCurrentTier] = useState<MembershipTier>('free')
  const [activeTab, setActiveTab] = useState<'membership' | 'addon'>('membership')
  const [payingPlanId, setPayingPlanId] = useState('')

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
      const [statusRes] = await Promise.all([
        request<MembershipData>({
          url: '/api/membership/get-status',
          method: 'POST',
          data: {}
        })
      ])

      if (statusRes.success && statusRes.data?.tier) {
        setCurrentTier(statusRes.data.tier)
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

  const handleSubscribe = async (plan: PlanItem) => {
    if (payingPlanId) return

    if (plan.tier && (currentTier === plan.tier || (currentTier === 'trial' && plan.tier === 'premium'))) {
      Taro.showToast({
        title: '当前已是该会员等级',
        icon: 'none'
      })
      return
    }

    try {
      setPayingPlanId(plan.id)

      const user = authService.getCurrentUser()
      if (!user?.wechat_openid) {
        const bindResult = await authService.bindWechatOpenid()
        if (!bindResult.success) {
          throw new Error(bindResult.message || '绑定微信失败，请使用微信快捷登录')
        }
      }

      const payment = await createMembershipWechatPayment({
        productKey: plan.id
      })

      if (!payment.success || !payment.data?.orderId || !payment.data?.paymentParams) {
        throw new Error(payment.message || '创建支付单失败，请稍后重试')
      }

      const paymentResult = await requestWechatPayment(payment.data.paymentParams)

      Taro.navigateTo({
        url: `/me/payment-waiting/index?orderId=${encodeURIComponent(payment.data.orderId)}&amount=${encodeURIComponent(String(payment.data.amount))}&provider=xpay&target=membership&membershipTab=${encodeURIComponent(activeTab)}&initialStatus=${encodeURIComponent(paymentResult.status)}`
      })
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || '拉起微信官方虚拟支付失败',
        icon: 'none'
      })
    } finally {
      setPayingPlanId('')
    }
  }

  return (
    <View className={`membership-subscribe-page theme-${effectiveTheme}`}>
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
                      className={`subscribe-btn ${payingPlanId === plan.id ? 'is-paying' : ''}`}
                      onClick={() => handleSubscribe(plan)}
                    >
                      <Text>{payingPlanId === plan.id ? '拉起支付中...' : '立即购买'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View className='notice-box'>
            <View className='notice-text'>
              <Notice /> 提示：购买将通过微信官方小程序虚拟支付完成，请确认当前微信账号已完成小程序登录。
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default MembershipSubscribe
