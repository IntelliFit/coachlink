import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import type { LucideIcon } from 'lucide-react'
import {
  User,
  UserPlus,
  Wallet,
  FileEdit,
  FileText,
  Shield,
  ChevronRight,
  Repeat,
  LogOut,
  BadgeCheck,
  Activity,
  Settings,
  MessageCircle
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { Icon } from '@/components/Icon'
import { authService } from '@/services/authService'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

interface ProfileActionItem {
  key: string
  title: string
  description: string
  icon: LucideIcon
  tone: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'slate' | 'purple'
  path?: string
  action?: () => void
  value?: string
  badge?: string
}

const COACH_BETA_GROUP_IMAGE = 'https://cdn-assets.coachlink.fit/beta-groups/coach-wechat-group.png'

function CoachMyProfile() {
  const { effectiveTheme } = useTheme()
  const [user, setUser] = useState<any>(null)
  const [coach, setCoach] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const openPage = useCallback((url: string) => {
    Taro.navigateTo({ url }).catch((navigateErr) => {
      console.error('[coach/my-profile] navigateTo 失败:', navigateErr)
      Taro.redirectTo({ url }).catch((redirectErr) => {
        console.error('[coach/my-profile] redirectTo 失败:', redirectErr)
        Taro.showToast({ title: '页面跳转失败', icon: 'none' })
      })
    })
  }, [])

  const switchToStudent = useCallback(async () => {
    try {
      await authService.switchRole('student')
      Taro.showToast({ title: '已切换到学员端', icon: 'success' })
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/index/index' }).catch((relaunchErr) => {
          console.error('[coach/my-profile] reLaunch student 失败:', relaunchErr)
          Taro.redirectTo({ url: '/pages/index/index' }).catch((redirectErr) => {
            console.error('[coach/my-profile] redirectTo student 失败:', redirectErr)
            Taro.showToast({ title: '切换后跳转失败', icon: 'none' })
          })
        })
      }, 400)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '切换失败', icon: 'none' })
    }
  }, [])

  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await authService.logout()
          Taro.showToast({ title: '已退出登录', icon: 'success' })
          setTimeout(() => {
            Taro.reLaunch({ url: '/auth/login' })
          }, 500)
        } catch (e) {
          console.error('[coach/my-profile] logout:', e)
          Taro.showToast({ title: '退出失败', icon: 'none' })
        }
      }
    })
  }, [])

  const handleJoinBetaGroup = useCallback(() => {
    Taro.previewImage({
      current: COACH_BETA_GROUP_IMAGE,
      urls: [COACH_BETA_GROUP_IMAGE],
    }).catch((error) => {
      console.error('[coach/my-profile] join beta group:', error)
      Taro.showToast({ title: '打开内测群失败', icon: 'none' })
    })
  }, [])

  const jumpToCoachProfile = useCallback((edit = false) => {
    if (!coach?.id) {
      Taro.showToast({ title: '未找到教练资料', icon: 'none' })
      return
    }
    const query = [`id=${encodeURIComponent(coach.id)}`]
    if (edit) {
      query.push('edit=1')
    }
    openPage(`/coach/profile/[id]?${query.join('&')}`)
  }, [coach?.id, openPage])

  const loadData = useCallback(async () => {
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated) {
      Taro.redirectTo({
        url: authService.buildLoginUrl('/coach/my-profile')
      }).catch(() => {
        Taro.reLaunch({ url: authService.buildLoginUrl('/coach/my-profile') })
      })
      return
    }

    const currentUser = session.user
    setUser(currentUser)

    if (!session.isCoach) {
      setCoach(null)
      setOverview(null)
      setAggregatedInfo(null)
      setError(null)
      setLoading(false)
      return
    }

    if (session.primaryRole !== 'coach') {
      setLoading(false)
      setError('当前处于学员端，请先切换到教练身份。')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const coachRes = await coachService.getCoach({ userId: currentUser.id })
      const resolvedCoach = coachRes?.coach || null

      const [overviewRes, aggregatedRes] = await Promise.all([
        coachService.getOverviewData(),
        resolvedCoach?.id ? coachService.getAggregatedInfo({ coachId: resolvedCoach.id }) : Promise.resolve(null)
      ])

      setCoach(aggregatedRes?.coach || resolvedCoach)
      setOverview(overviewRes)
      setAggregatedInfo(aggregatedRes)
    } catch (e) {
      console.error('[coach/my-profile] load:', e)
      setError('加载教练信息失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    void loadData()
  })

  const displayName = coach?.name || user?.nickname || user?.real_name || user?.phone || '教练'
  const displayTitle = coach?.title || '完善主页资料，方便学员更快认识你'
  const displayAvatar = coach?.avatar_url || user?.avatar_url || ''
  const specialties = Array.isArray(coach?.specialties) ? coach.specialties.filter(Boolean) : []
  const contentCount = aggregatedInfo?.contentCount ?? overview?.contentCount ?? 0
  const pricingReady = !!overview?.pricingReady
  const questionReady = !!overview?.questionReady

  const quickActions = useMemo<ProfileActionItem[]>(() => [
    {
      key: 'coach-home',
      title: '我的主页',
      description: '查看学员看到的教练主页',
      icon: User,
      tone: 'blue',
      action: () => jumpToCoachProfile(false)
    },
    {
      key: 'profile-settings',
      title: '个人设置',
      description: '编辑教练介绍、专长、案例与联系方式',
      icon: Settings,
      tone: 'indigo',
      action: () => jumpToCoachProfile(true)
    },
    {
      key: 'wallet',
      title: '我的钱包',
      description: '查看余额、流水与提现说明',
      icon: Wallet,
      tone: 'amber',
      path: '/coach/wallet'
    }
  ], [jumpToCoachProfile])

  const businessActions = useMemo<ProfileActionItem[]>(() => [
    {
      key: 'invitation',
      title: '邀请学员',
      description: '邀请码、邀请链接和邀请海报',
      icon: UserPlus,
      tone: 'emerald',
      path: '/coach/settings/invitation'
    },
    {
      key: 'pricing',
      title: '订阅设置',
      description: '管理会员方案与定价',
      icon: BadgeCheck,
      tone: pricingReady ? 'emerald' : 'rose',
      path: '/coach/pricing',
      badge: pricingReady ? '已就绪' : '待配置'
    },
    {
      key: 'questionnaire',
      title: '学员问卷',
      description: '收集训练目标与基础信息',
      icon: FileText,
      tone: questionReady ? 'emerald' : 'amber',
      path: '/coach/questionnaire',
      badge: questionReady ? '已开启' : '待设置'
    },
    {
      key: 'content',
      title: '内容管理',
      description: '维护文章、课程与内容资产',
      icon: FileEdit,
      tone: 'purple',
      path: '/coach/content',
      value: `${contentCount}`
    },
    {
      key: 'action-lib',
      title: '动作库',
      description: '整理动作演示与教学素材',
      icon: Activity,
      tone: 'blue',
      path: '/coach/action-lib'
    },
    {
      key: 'payment-settings',
      title: '收款账户',
      description: '开通汇付账户并绑定银行卡',
      icon: Wallet,
      tone: 'emerald',
      path: '/coach/wallet/merchant'
    }
  ], [contentCount, pricingReady, questionReady])

  const accountActions = useMemo<ProfileActionItem[]>(() => [
    {
      key: 'security',
      title: '安全设置',
      description: '修改密码与账号安全验证',
      icon: Shield,
      tone: 'slate',
      path: '/coach/settings/security'
    },
    {
      key: 'account',
      title: '账户设置',
      description: '查看通用账号绑定与基础设置',
      icon: Settings,
      tone: 'slate',
      path: '/me/settings/index'
    },
    {
      key: 'feedback',
      title: '意见反馈',
      description: '提交产品建议、问题截图和诊断信息',
      icon: MessageCircle,
      tone: 'indigo',
      path: '/me-legal/feedback/index'
    },
    {
      key: 'join-beta-group',
      title: '加入内测群',
      description: '加入教练端内测群，接收教练端更新和反馈沟通',
      icon: MessageCircle,
      tone: 'indigo',
      action: handleJoinBetaGroup
    },
    {
      key: 'switch-role',
      title: '切换到学员端',
      description: '返回学员视角继续使用训练功能',
      icon: Repeat,
      tone: 'blue',
      action: switchToStudent
    },
    {
      key: 'logout',
      title: '退出登录',
      description: '退出当前账号',
      icon: LogOut,
      tone: 'rose',
      action: handleLogout
    }
  ], [handleJoinBetaGroup, handleLogout, switchToStudent])

  const handleActionClick = useCallback((item: ProfileActionItem) => {
    if (item.action) {
      item.action()
      return
    }
    if (item.path) {
      openPage(item.path)
    }
  }, [openPage])

  if (loading) {
    return (
      <View className={`coach-my-profile-page theme-${effectiveTheme}`}>
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  if (!user?.is_coach) {
    return (
      <View className={`coach-my-profile-page theme-${effectiveTheme}`}>
        <View className='empty-state-card'>
          <Text className='empty-state-title'>当前还不是教练身份</Text>
          <Text className='empty-state-desc'>完成教练申请并审核通过后，这里会显示教练端的个人中心。</Text>
          <View className='empty-state-action' onClick={() => openPage('/coach/application')}>
            <Text className='empty-state-action-text'>去申请成为教练</Text>
          </View>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (error) {
    return (
      <View className={`coach-my-profile-page theme-${effectiveTheme}`}>
        <View className='empty-state-card'>
          <Text className='empty-state-title'>{error}</Text>
          <View className='empty-state-action' onClick={() => void loadData()}>
            <Text className='empty-state-action-text'>重新加载</Text>
          </View>
        </View>
        <BottomNav />
      </View>
    )
  }

  const renderActionRow = (item: ProfileActionItem) => (
    <View key={item.key} className='action-row' onClick={() => handleActionClick(item)}>
      <View className={`action-icon ${item.tone}`}>
        <Icon component={item.icon} size={18} color='currentColor' />
      </View>
      <View className='action-body'>
        <Text className='action-title'>{item.title}</Text>
        <Text className='action-desc'>{item.description}</Text>
      </View>
      <View className='action-meta'>
        {item.value ? <Text className='action-value'>{item.value}</Text> : null}
        {item.badge ? <Text className={`action-badge ${item.badge === '已就绪' || item.badge === '已开启' ? 'ready' : 'pending'}`}>{item.badge}</Text> : null}
        <Icon component={ChevronRight} size={16} color='#cbd5e1' />
      </View>
    </View>
  )

  return (
    <View className={`coach-my-profile-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className='profile-scroll'>
        <View className='hero-card'>
          <View className='hero-top'>
            <View className='avatar-shell'>
              {displayAvatar ? (
                <Image className='avatar' src={displayAvatar} mode='aspectFill' />
              ) : (
                <View className='avatar-placeholder'>
                  <Text className='avatar-placeholder-text'>{displayName.substring(0, 1)}</Text>
                </View>
              )}
            </View>
            <View className='hero-main'>
              <Text className='hero-name'>{displayName}</Text>
              <Text className='hero-title'>{displayTitle}</Text>
              <View className='hero-tags'>
                <View className='hero-tag role'>
                  <Text className='hero-tag-text'>教练身份</Text>
                </View>
                {specialties.slice(0, 3).map((specialty: string) => (
                  <View key={specialty} className='hero-tag specialty'>
                    <Text className='hero-tag-text'>{specialty}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className='hero-summary'>
            <View className='hero-summary-item'>
              <Text className='hero-summary-label'>订阅设置</Text>
              <Text className='hero-summary-value'>{pricingReady ? '已配置' : '待完善'}</Text>
            </View>
            <View className='hero-summary-item'>
              <Text className='hero-summary-label'>学员问卷</Text>
              <Text className='hero-summary-value'>{questionReady ? '已开启' : '待开启'}</Text>
            </View>
          </View>

          <View className='hero-contact'>
            <Text className='contact-item'>手机号：{user?.phone || '-'}</Text>
            <Text className='contact-item'>邮箱：{user?.email || '-'}</Text>
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>个人入口</Text>
              <Text className='section-subtitle'>先把最常用的教练个人操作收在一起</Text>
            </View>
          </View>
          <View className='action-list'>
            {quickActions.map(renderActionRow)}
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>业务配置</Text>
              <Text className='section-subtitle'>把高频业务入口收在一起，避免和概览页重复堆信息</Text>
            </View>
          </View>
          <View className='action-list'>
            {businessActions.map(renderActionRow)}
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <View>
              <Text className='section-title'>账号与安全</Text>
              <Text className='section-subtitle'>身份切换、通用设置与退出登录</Text>
            </View>
          </View>
          <View className='action-list'>
            {accountActions.map(renderActionRow)}
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachMyProfile
