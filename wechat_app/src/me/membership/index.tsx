import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { request } from '@/utils/request'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import './index.scss'

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

const TIER_TEXT: Record<MembershipTier, string> = {
  free: '免费用户',
  basic: '基础会员',
  premium: '高级会员',
  trial: '试用会员'
}

const AI_HINT_BY_TIER: Record<MembershipTier, string> = {
  free: '用于生成个性化训练计划',
  basic: '用于生成个性化训练计划',
  premium: '高级会员无限量使用',
  trial: '试用期间按活动规则使用'
}

const TIER_TONE_CLASS: Record<MembershipTier, string> = {
  free: 'tier-pill-neutral',
  basic: 'tier-pill-info',
  premium: 'tier-pill-premium',
  trial: 'tier-pill-trial'
}

export default function MembershipPage() {
  const [membership, setMembership] = useState<MembershipData | null>(null)
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMembership = useCallback(async () => {
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
      console.error('加载会员数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadMembership()
  })

  usePullDownRefresh(() => {
    loadMembership().finally(() => Taro.stopPullDownRefresh())
  })

  const navigateToSubscribe = (tab: 'membership' | 'addon' = 'membership') => {
    Taro.navigateTo({ url: `/me/membership/subscribe/index?tab=${tab}` })
  }

  const navigateToReferral = () => {
    Taro.navigateTo({ url: '/me/membership/referral/index' })
  }

  if (loading) {
    return (
      <View className='membership-page'>
        <View className='loading-wrap'>
          <LoadingSpinner size={48} />
        </View>
        <BottomNav />
      </View>
    )
  }

  const tier = membership?.tier || 'free'
  const isFree = tier === 'free'
  const isPremium = tier === 'premium'
  const aiRemaining = Math.max(0, Number(quota?.ai_import_balance || 0))
  const storageUsed = Math.max(0, Number(quota?.storage_used_mb || 0))
  const storageTotal = Math.max(1, Number(quota?.storage_total_mb || 0))
  const storagePercent = Math.min(100, Math.round((storageUsed / storageTotal) * 100))
  const endDateText =
    membership?.status === 'active' && membership?.end_date
      ? `有效期至：${new Date(membership.end_date).toLocaleDateString()}`
      : ''

  return (
    <View className='membership-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='status-card'>
            <View className='card-head'>
              <View className='card-head-copy'>
                <Text className='card-title'>当前等级</Text>
                <Text className='card-subtitle'>您的会员权益状态</Text>
              </View>
              <View className={`tier-mark ${TIER_TONE_CLASS[tier]}`}>
                <Text className='tier-mark-text'>会</Text>
              </View>
            </View>

            <View className='status-row'>
              <View className={`tier-pill ${TIER_TONE_CLASS[tier]}`}>
                <Text className='tier-pill-text'>{TIER_TEXT[tier]}</Text>
              </View>
              {endDateText ? <Text className='status-date'>{endDateText}</Text> : null}
            </View>

            {isFree ? (
              <View className='upgrade-panel'>
                <Text className='upgrade-copy'>
                  升级会员解锁更多智能生成次数和存储空间，提升训练效率。
                </Text>
                <View className='action-button primary' onClick={() => navigateToSubscribe('membership')}>
                  <Text className='action-button-text primary'>立即升级</Text>
                </View>
              </View>
            ) : (
              <View className='actions-row'>
                <View className='action-button secondary' onClick={() => navigateToSubscribe('membership')}>
                  <Text className='action-button-text secondary'>续费/升级</Text>
                </View>
              </View>
            )}
          </View>

          <View className='quota-grid'>
            <View className='quota-card'>
              <View className='quota-head'>
                <Text className='quota-title'>智能导入次数</Text>
                <View className='quota-badge'>
                  <Text className='quota-badge-text'>AI</Text>
                </View>
              </View>
              <View className='quota-main-row'>
                <Text className='quota-value'>{aiRemaining}</Text>
                <Text className='quota-unit'>次</Text>
              </View>
              <Text className='quota-note'>{AI_HINT_BY_TIER[tier]}</Text>
              {!isPremium ? (
                <View className='inline-link' onClick={() => navigateToSubscribe('addon')}>
                  <Text className='inline-link-text'>购买加油包</Text>
                </View>
              ) : null}
            </View>

            <View className='quota-card'>
              <View className='quota-head'>
                <Text className='quota-title'>云存储空间</Text>
                <View className='quota-badge'>
                  <Text className='quota-badge-text'>MB</Text>
                </View>
              </View>
              <View className='quota-storage-row'>
                <Text className='quota-value'>{storageUsed.toFixed(1)}</Text>
                <Text className='quota-unit'>/ {storageTotal.toFixed(0)} MB</Text>
              </View>
              <View className='progress-track'>
                <View className='progress-fill' style={{ width: `${storagePercent}%` }} />
              </View>
              <Text className='quota-note'>用于存储训练视频和动态</Text>
              <View className='inline-link' onClick={() => navigateToSubscribe('addon')}>
                <Text className='inline-link-text'>扩容空间</Text>
              </View>
            </View>
          </View>

          <View className='referral-card'>
            <View className='referral-copy'>
              <Text className='referral-title'>邀请好友，免费领会员</Text>
              <Text className='referral-subtitle'>
                每邀请一位好友注册，双方各获 AI 导入 +2 次 和 存储 +200MB 奖励。
              </Text>
            </View>
            <View className='action-button tertiary' onClick={navigateToReferral}>
              <Text className='action-button-text tertiary'>去邀请</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}
