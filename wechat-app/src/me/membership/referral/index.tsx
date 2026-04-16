import { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, {
  useDidShow,
  usePullDownRefresh,
  useShareAppMessage,
  useShareTimeline
} from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getReferralShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'
import { File, Star } from '@nutui/icons-react-taro'

interface ReferralData {
  code: string
  inviteLink: string
  shareText: string
  totalReferrals: number
  totalRewards: {
    ai_import: number
    storage_mb: number
  }
}

interface ReferralInviteData {
  inviteCode: string
  inviteLink: string
  shareText: string
}

interface ReferralStatsData {
  invites: number
  rewardedAi: number
  rewardedStorageMb: number
}

function MembershipReferral() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const inviteFromParams = useMemo(() => {
    const value = Taro.getCurrentInstance().router?.params?.invite
    return typeof value === 'string' ? value.trim() : ''
  }, [])
  const inviteSharePayload = useMemo(
    () =>
      createSharePayload({
        title: getReferralShareTitle(referralData?.shareText),
        path: buildSharePath('/auth/register', {
          invite: referralData?.code || undefined
        })
      }),
    [referralData?.code, referralData?.shareText]
  )

  useShareAppMessage(() => inviteSharePayload)
  useShareTimeline(() => createTimelinePayload(inviteSharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        if (inviteFromParams) {
          await Taro.redirectTo({
            url: `/auth/register?invite=${encodeURIComponent(inviteFromParams)}`
          })
          return
        }
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const [inviteRes, statsRes] = await Promise.all([
        request<ReferralInviteData>({
          url: '/api/membership/referral/create-invite',
          method: 'POST',
          data: {}
        }),
        request<ReferralStatsData>({
          url: '/api/membership/referral/stats',
          method: 'POST',
          data: {}
        })
      ])

      if (!inviteRes.success && !statsRes.success) {
        throw new Error(inviteRes.message || statsRes.message || '加载失败')
      }

      setReferralData({
        code: inviteRes.data?.inviteCode || userId,
        inviteLink: inviteRes.data?.inviteLink || '',
        shareText: inviteRes.data?.shareText || '',
        totalReferrals: statsRes.data?.invites || 0,
        totalRewards: {
          ai_import: statsRes.data?.rewardedAi || 0,
          storage_mb: statsRes.data?.rewardedStorageMb || 0
        }
      })
    } catch (error) {
      console.error('加载邀请数据失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [inviteFromParams])

  useDidShow(() => {
    loadData()
  })

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh())
  })

  const handleCopyCode = () => {
    if (referralData?.code) {
      Taro.setClipboardData({
        data: referralData.code,
        success: () => {
          Taro.showToast({ title: '邀请码已复制', icon: 'success' })
        }
      })
    }
  }

  const handleCopyInviteLink = () => {
    if (!referralData?.inviteLink) {
      Taro.showToast({ title: '暂无可复制的邀请链接', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: referralData.inviteLink,
      success: () => {
        Taro.showToast({ title: '邀请链接已复制', icon: 'success' })
      }
    })
  }

  const handlePrepareShare = () => {
    const shareContent = referralData?.inviteLink
      ? `${referralData?.shareText || '一起加入 CoachLink 训练'}\n${referralData.inviteLink}`
      : (referralData?.shareText || referralData?.code || '')

    if (shareContent.trim()) {
      Taro.setClipboardData({
        data: shareContent,
        success: () => {
          Taro.showToast({ title: '邀请内容已复制，可直接粘贴分享', icon: 'success' })
        }
      })
    } else {
      Taro.showToast({ title: '暂无可分享内容', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className='referral-page'>
        <ScrollView className='page-scroll' scrollY>
          <View className='loading-wrap'>
            <Text>加载中...</Text>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className='referral-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>邀请好友</Text>
            <Text className='page-subtitle'>每邀请一位好友注册，双方各获奖励</Text>
          </View>

          {/* 邀请码卡片 */}
          <View className='code-card'>
            <Text className='code-label'>我的邀请码</Text>
            <View className='code-display'>
              <Text className='code-text'>{referralData?.code || '---'}</Text>
            </View>
            {referralData?.inviteLink ? (
              <View className='invite-link-box'>
                <Text className='invite-link-label'>邀请链接</Text>
                <Text className='invite-link-text' selectable>{referralData.inviteLink}</Text>
              </View>
            ) : null}
            <View className='code-actions'>
              <View className='action-btn' onClick={handleCopyCode}>
                <Text>复制邀请码</Text>
              </View>
              <View className='action-btn' onClick={handleCopyInviteLink}>
                <Text>复制邀请链接</Text>
              </View>
              <Button className='action-btn primary share-action-btn' openType='share' onClick={handlePrepareShare}>
                <Text>分享邀请</Text>
              </Button>
            </View>
          </View>

          {/* 奖励说明 */}
          <View className='reward-card'>
            <Text className='reward-title'>邀请奖励</Text>
            <View className='reward-list'>
              <View className='reward-item'>
                <View className='reward-icon'><Star /></View>
                <View className='reward-content'>
                  <Text className='reward-label'>AI 导入次数</Text>
                  <Text className='reward-value'>+2 次</Text>
                </View>
              </View>
              <View className='reward-item'>
                <View className='reward-icon'><File /></View>
                <View className='reward-content'>
                  <Text className='reward-label'>云存储空间</Text>
                  <Text className='reward-value'>+200MB</Text>
                </View>
              </View>
            </View>
            <Text className='reward-note'>
              * 每邀请一位好友注册，双方各获得以上奖励
            </Text>
          </View>

          {/* 统计信息 */}
          <View className='stats-card'>
            <Text className='stats-title'>邀请统计</Text>
            <View className='stats-grid'>
              <View className='stat-item'>
                <Text className='stat-value'>{referralData?.totalReferrals || 0}</Text>
                <Text className='stat-label'>已邀请好友</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{referralData?.totalRewards?.ai_import || 0}</Text>
                <Text className='stat-label'>累计 AI 次数</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{referralData?.totalRewards?.storage_mb || 0}MB</Text>
                <Text className='stat-label'>累计存储</Text>
              </View>
            </View>
            <Text className='reward-note'>
              * 当前奖励口径：每次有效邀请双方各得 AI +2 次、存储 +200MB
            </Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default MembershipReferral
