import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { request } from '@/utils/request'
import './index.scss'
import { Check, Close } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type MembershipTier = 'free' | 'basic' | 'premium' | 'trial'

interface MembershipData {
  tier: MembershipTier
  status: 'active' | 'expired'
  end_date: string | null
}

interface QuotaData {
  ai_import_balance: number
  storage_total_mb: number
  storage_used_mb: number
}

const AI_LIMIT_BY_TIER: Record<MembershipTier, number | null> = {
  free: 2,
  basic: 10,
  premium: null,
  trial: null
}

const TIER_TEXT: Record<MembershipTier, string> = {
  free: '免费用户',
  basic: '基础会员',
  premium: '高级会员',
  trial: '试用会员'
}

export default function MembershipPage() {
  const [membership, setMembership] = useState<MembershipData | null>(null)
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadQuota = useCallback(async () => {
    try {
      setLoading(true)
      const [statusRes, quotaRes] = await Promise.all([
        request<MembershipData>({
          url: '/api/membership/get-status',
          method: 'POST',
          data: {}
        }),
        request<QuotaData>({
          url: '/api/membership/get-quota',
          method: 'POST',
          data: {}
        })
      ])

      if (statusRes.success && statusRes.data) {
        setMembership(statusRes.data)
      }
      if (quotaRes.success && quotaRes.data) {
        setQuota(quotaRes.data)
      }
    } catch (error) {
      console.error('加载配额失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadQuota()
  })

  usePullDownRefresh(() => {
    loadQuota().finally(() => Taro.stopPullDownRefresh())
  })

  const handleUpgrade = (tab: 'membership' | 'addon' = 'membership') => {
    Taro.navigateTo({ url: `/me/membership/subscribe/index?tab=${tab}` })
  }

  if (loading) {
    return (
      <View className='membership-page'>
        <View className="loading"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  const tier = membership?.tier || 'free'
  const aiTotal = AI_LIMIT_BY_TIER[tier]
  const aiRemaining = Math.max(0, Number(quota?.ai_import_balance || 0))
  const aiUsed = aiTotal == null ? 0 : Math.max(0, aiTotal - aiRemaining)
  const aiPercent = aiTotal == null || aiTotal <= 0 ? 0 : Math.min(100, Math.round((aiUsed / aiTotal) * 100))

  const storageUsed = Math.max(0, Number(quota?.storage_used_mb || 0))
  const storageTotal = Math.max(1, Number(quota?.storage_total_mb || 200))
  const storagePercent = Math.min(100, Math.round((storageUsed / storageTotal) * 100))

  return (
    <View className='membership-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          {/* 会员状态卡片 */}
          <View className='membership-card'>
            <View className='tier-badge'>
              <Text>{TIER_TEXT[tier]}</Text>
            </View>
            <Text className='expiry-text'>
              {membership?.status === 'active' && membership?.end_date
                ? `有效期至 ${new Date(membership.end_date).toLocaleDateString()}`
                : '长期有效'}
            </Text>
          </View>

          {/* AI导入配额 */}
          <View className='quota-card'>
            <View className='quota-header'>
              <Text className='quota-title'>AI 导入配额</Text>
              <Text className={`quota-status ${aiPercent >= 80 ? 'warning' : ''}`}>
                {aiTotal == null ? '无限次可用' : `${aiRemaining} 次剩余`}
              </Text>
            </View>
            {aiTotal != null && (
              <View className='progress-bar'>
                <View
                  className={`progress-fill ${aiPercent >= 80 ? 'warning' : ''}`}
                  style={{ width: `${aiPercent}%` }}
                />
              </View>
            )}
            <Text className='quota-detail'>
              {aiTotal == null ? '高级会员无限量使用' : `已用 ${aiUsed} / ${aiTotal} 次`}
            </Text>
            {aiTotal != null && aiPercent >= 80 && (
              <View className='upgrade-tip' onClick={() => handleUpgrade(aiRemaining <= 0 ? 'addon' : 'membership')}>
                <Text>{aiRemaining <= 0 ? '配额已耗尽，去购买加油包' : '配额偏低，去升级会员'}</Text>
              </View>
            )}
          </View>

          {/* 云存储配额 */}
          <View className='quota-card'>
            <View className='quota-header'>
              <Text className='quota-title'> 云存储空间</Text>
              <Text className={`quota-status ${storagePercent >= 80 ? 'warning' : ''}`}>
                {storageUsed.toFixed(1)} / {storageTotal.toFixed(0)} MB
              </Text>
            </View>
            <View className='progress-bar'>
              <View
                className={`progress-fill ${storagePercent >= 80 ? 'warning' : ''}`}
                style={{ width: `${storagePercent}%` }}
              />
            </View>
            {storagePercent >= 80 && (
              <View className='upgrade-tip' onClick={() => handleUpgrade('addon')}>
                <Text>存储空间偏低，去购买扩容包</Text>
              </View>
            )}
          </View>

          {/* 会员权益 */}
          <View className='benefits-section'>
            <Text className='section-title'>会员权益</Text>
            <View className='benefit-list'>
              <View className='benefit-item'>
                <View className='benefit-icon'><Check /></View>
                <Text className='benefit-text'>无限次 AI 计划导入</Text>
              </View>
              <View className='benefit-item'>
                <View className='benefit-icon'><Check /></View>
                <Text className='benefit-text'>10GB 云存储空间</Text>
              </View>
              <View className='benefit-item'>
                <View className='benefit-icon'><Check /></View>
                <Text className='benefit-text'>高级训练数据分析</Text>
              </View>
              <View className='benefit-item disabled'>
                <View className='benefit-icon'><Close /></View>
                <Text className='benefit-text'>专属客服支持（高级会员）</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}
