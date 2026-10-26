import { useState, useEffect, useCallback, useMemo } from 'react'
import { WECHAT_FREE_RELEASE } from '@coachlink/core'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import { coachService } from '@/services/coach/coachService'
import { studentActionLibService } from '@/services/studentActionLibService'
import { studentPlanLibService } from '@/services/studentPlanLibService'
import { studentService } from '@/services/studentService'
import { trainingHistoryService } from '@/services/trainingHistoryService'
import { chatService } from '@/services/chatService'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import { AUTH_SESSION_INVALID_EVENT } from '@/services/authSessionEvents'
import './index.scss'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { XPayTrialEntry } from '@/components/XPayTrialEntry'
import { ClButton, ClTag } from '@/components/ui'
import { getCapsuleLayout } from '@/utils/capsuleLayout'
import { announcementService } from '@/services/announcementService'
import { useAnnouncementFeed } from '@/hooks/useAnnouncementFeed'
interface MenuItem {
  key: string
  label: string
  icon: string
  path?: string
  action?: () => void
  badge?: string
  requiresAuth?: boolean
}

interface StatMenuItem extends MenuItem {
  value: number
  unit: string
}

interface ProfileStats {
  actions: number
  plans: number
  trainingActions: number
  monthDays: number | null
  monthSets: number | null
  unreadMessages: number
}

const EMPTY_PROFILE_STATS: ProfileStats = {
  actions: 0,
  plans: 0,
  trainingActions: 0,
  monthDays: null,
  monthSets: null,
  unreadMessages: 0
}

const LEGAL_LINKS: Array<{ label: string; url: string }> = [
  { label: '关于', url: '/me-legal/about/index' },
  { label: '联系我们', url: '/me-legal/contact/index' },
  { label: '文档', url: '/me-legal/docs/index' },
  { label: '入驻说明', url: '/auth/onboarding' },
  { label: '免责声明', url: '/me-legal/disclaimer/index' },
  { label: '消费者权益保护', url: '/me-legal/protection-of-consumer/index' },
  { label: '用户服务协议', url: '/me-legal/terms/index' },
  { label: '平台入驻协议', url: '/me-legal/platform-agreement/index' }
]

function getProfileMissingCount(profile: any, answers: any) {
  const goals = Array.isArray(answers?.fitness_goals) && answers.fitness_goals.length
    ? answers.fitness_goals
    : (profile?.fitness_goal ? [profile.fitness_goal] : [])
  const checks = [
    String(profile?.nickname || '').trim(),
    String(profile?.gender || '').trim(),
    Number(profile?.height || 0) > 0,
    Number(profile?.weight || 0) > 0,
    goals.length > 0,
    String(profile?.fitness_level || '').trim(),
    Number(answers?.weekly_frequency || 0) > 0,
    Number(answers?.session_duration || 0) > 0
  ]
  return checks.filter((value) => !value).length
}

const STUDENT_BETA_GROUP_IMAGE = 'https://cdn-assets.coachlink.fit/beta-groups/student-wechat-group.png'

function Profile() {
  const { effectiveTheme } = useTheme()
  const { isDark, toggleTheme } = useTheme()
  const [user, setUser] = useState<any>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profileStats, setProfileStats] = useState<ProfileStats>(EMPTY_PROFILE_STATS)
  const [profileMissingCount, setProfileMissingCount] = useState(0)
  const [legalOpen, setLegalOpen] = useState(false)

  const openLogin = useCallback((returnTo = '/me/profile/index') => {
    const url = authService.buildLoginUrl(returnTo)
    Taro.navigateTo({ url }).catch(() => {
      Taro.redirectTo({ url }).catch(() => {
        Taro.reLaunch({ url }).catch((error) => {
          console.error('[profile] open login:', error)
        })
      })
    })
  }, [])

  const loadProfileStats = useCallback(async () => {
    try {
      const monthKey = toBeijingDateKey(new Date()).slice(0, 7)
      const [actionsRes, plansRes, trainingSummary, monthShare, chatrooms] = await Promise.all([
        studentActionLibService.listActions({ page: 1, limit: 1 }),
        studentPlanLibService.listFavorites({ page: 1, limit: 1 }),
        trainingHistoryService.getSummary(),
        trainingHistoryService.getMonthShare(monthKey).catch(() => null),
        chatService.listChatrooms({ page: 1, limit: 50 }).catch(() => null)
      ])

      setProfileStats({
        actions: Number(actionsRes?.totalCount ?? actionsRes?.actions?.length ?? 0),
        plans: Number(plansRes?.totalCount ?? plansRes?.total ?? plansRes?.favorites?.length ?? 0),
        trainingActions: Number(trainingSummary?.totalActions ?? 0),
        monthDays: monthShare ? Number(monthShare.trainingDays || 0) : null,
        monthSets: monthShare ? Number(monthShare.totalSets || 0) : null,
        unreadMessages: (chatrooms?.chatRooms || []).reduce((sum, room) => sum + Number(room.unreadCount || 0), 0)
      })
    } catch (error) {
      console.error('[profile] load stats:', error)
    }
  }, [])

  async function loadCoachId(userId: string) {
    try {
      const res = await coachService.getCoach({ userId })
      if (res?.coach?.id) {
        setCoachId(res.coach.id)
      }
    } catch (error) {
      console.error('[profile] load coach id:', error)
    }
  }

  const loadCurrentUser = useCallback(async () => {
    const session = authService.getAuthSession({ normalize: true })
    const currentUser = session.user

    setIsAuthenticated(session.isAuthenticated)

    if (session.isAuthenticated && session.isCoach && session.primaryRole === 'coach') {
      Taro.reLaunch({ url: '/coach/my-profile' }).catch(() => {
        Taro.redirectTo({ url: '/coach/my-profile' }).catch((error) => {
          console.error('[profile] jump to coach profile:', error)
        })
      })
      return
    }

    setUser(currentUser)

    if (!session.isAuthenticated || !session.userId) {
      setCoachId(null)
      setProfileStats(EMPTY_PROFILE_STATS)
      setProfileMissingCount(0)
      return
    }

    void loadProfileStats()

    if (currentUser?.is_coach && currentUser?.id) {
      void loadCoachId(currentUser.id)
    } else {
      setCoachId(null)
    }

    try {
      const profileRes = await studentService.getStudentProfile(currentUser.id)
      const profile = profileRes?.profile
      if (!profile || typeof profile !== 'object') return
      setProfileMissingCount(getProfileMissingCount(profile, profileRes?.questionnaire?.answers || {}))

      let changed = false
      const nextUser = { ...currentUser }

      if (Object.prototype.hasOwnProperty.call(profile, 'avatar_url') && nextUser.avatar_url !== profile.avatar_url) {
        nextUser.avatar_url = profile.avatar_url ?? null
        changed = true
      }

      if (Object.prototype.hasOwnProperty.call(profile, 'nickname') && nextUser.nickname !== profile.nickname) {
        nextUser.nickname = profile.nickname ?? ''
        changed = true
      }

      if (!changed) return

      authService.setCurrentUser(nextUser)
      setUser(nextUser)
    } catch (error) {
      console.error('[profile] sync current user profile:', error)
    }
  }, [loadProfileStats])

  useEffect(() => {
    void loadCurrentUser()
  }, [loadCurrentUser])

  useEffect(() => {
    const handleAuthInvalid = () => {
      setUser(null)
      setCoachId(null)
      setIsAuthenticated(false)
      setProfileStats(EMPTY_PROFILE_STATS)
    }

    Taro.eventCenter.on(AUTH_SESSION_INVALID_EVENT, handleAuthInvalid)
    return () => {
      Taro.eventCenter.off(AUTH_SESSION_INVALID_EVENT, handleAuthInvalid)
    }
  }, [])

  const announcementFeed = useAnnouncementFeed()
  useDidShow(() => {
    void loadCurrentUser()
    void announcementService.load(60 * 1000)
  })

  const points = user?.points ?? 0
  const primaryRole = user?.primary_role === 'coach' ? 'coach' : 'student'
  const isCoach = !!user?.is_coach
  const canSwitchRole = isAuthenticated && isCoach
  const displayName = isAuthenticated
    ? String(user?.nickname || user?.real_name || user?.phone || 'CoachLink 学员')
    : '未登录'
  const displaySubtitle = isAuthenticated
    ? String(user?.phone || '训练、服务和消息会在这里持续沉淀')
    : WECHAT_FREE_RELEASE ? '登录后同步训练记录、计划和消息' : '登录后同步训练记录、会员、订单和消息'
  const roleBadgeText = isAuthenticated ? (primaryRole === 'coach' ? '教练身份' : '学员身份') : '游客模式'

  async function handleProfileSettings() {
    if (isCoach) {
      let targetCoachId = coachId

      if (!targetCoachId && user?.id) {
        try {
          const res = await coachService.getCoach({ userId: user.id })
          if (res?.coach?.id) {
            targetCoachId = res.coach.id
            setCoachId(targetCoachId)
          }
        } catch (error) {
          console.error('[profile] load coach id for edit:', error)
        }
      }

      if (!targetCoachId) {
        Taro.showToast({
          title: '获取教练信息失败',
          icon: 'none'
        })
        return
      }

      Taro.navigateTo({
        url: `/coach/profile/[id]?id=${targetCoachId}&edit=1`
      }).catch(() => {
        Taro.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
      })
      return
    }

    Taro.navigateTo({
      url: '/me/profile/edit/index'
    }).catch(() => {
      Taro.showToast({ title: '页面跳转失败', icon: 'none' })
    })
  }

  const statMenus: StatMenuItem[] = [
    {
      key: 'action-library',
      label: '我的动作库',
      value: profileStats.actions,
      unit: '项',
      icon: 'icon-dumbbell',
      path: '/me/action-lib/index',
      requiresAuth: true
    },
    {
      key: 'plan-library',
      label: '我的计划库',
      value: profileStats.plans,
      unit: '项',
      icon: 'icon-a-Trainingplan',
      path: '/me/plan-lib/index',
      requiresAuth: true
    },
    {
      key: 'training-history',
      label: '训练记录',
      value: profileStats.trainingActions,
      unit: '个动作',
      icon: 'icon-training_history',
      path: '/me/training-history/index',
      requiresAuth: true
    }
  ]

  const gridMenus: MenuItem[] = [
    { key: 'current-plan', label: '全部计划', icon: 'icon-a-Trainingplan', path: '/me/plan-history/index', requiresAuth: true },
    { key: 'ranking', label: '排行榜', icon: 'icon-ranking', path: '/discovery/ranking', requiresAuth: true },
    { key: 'my-coaches', label: '我的教练', icon: 'icon-coachline_line', path: '/me/my-coaches/index', requiresAuth: true },
    {
      key: 'messages',
      label: '消息中心',
      icon: 'icon-messages',
      path: '/me/messages/index',
      badge: profileStats.unreadMessages > 0 ? String(Math.min(profileStats.unreadMessages, 99)) : undefined,
      requiresAuth: true
    },
    {
      key: 'announcements',
      label: '平台通知',
      icon: 'icon-messages',
      path: '/me/announcements/index',
      badge: announcementFeed.unreadCount > 0 ? String(Math.min(announcementFeed.unreadCount, 99)) : undefined,
      requiresAuth: true
    },
    {
      key: 'my-membership',
      label: WECHAT_FREE_RELEASE ? '功能与用量' : '我的会员',
      icon: WECHAT_FREE_RELEASE ? 'icon-account-settings-variant' : 'icon-vips',
      path: '/me/membership/index',
      requiresAuth: true
    },
    { key: 'purchase-history', label: '购买记录', icon: 'icon-goumaijilu', path: '/me/purchase-history/index', requiresAuth: true },
    { key: 'join-beta-group', label: '内测群', icon: 'icon-friends-o', action: handleJoinBetaGroup },
    canSwitchRole
      ? {
          key: 'switch-role',
          label: primaryRole === 'coach' ? '切到学员端' : '切到教练端',
          icon: primaryRole === 'coach' ? 'icon-shenqingquanxian' : 'icon-coachline_line',
          action: handleSwitchRole,
          requiresAuth: true
        }
      : {
          key: 'apply-coach',
          label: '申请成为教练',
          icon: 'icon-shenqingquanxian',
          path: isAuthenticated ? '/coach/application' : '/auth/onboarding'
        }
  ]

  function handleMenuClick(item: MenuItem) {
    if (!isAuthenticated && item.requiresAuth) {
      openLogin(item.path || '/me/profile/index')
      return
    }
    if (item.action) {
      item.action()
    } else if (item.path) {
      Taro.navigateTo({ url: item.path }).catch((error) => {
        console.error('[profile] navigate menu:', error)
        Taro.showToast({ title: '页面跳转失败', icon: 'none' })
      })
    }
  }

  function handleViewProfile() {
    if (!isAuthenticated || !user?.id) {
      openLogin('/me/profile/detail/index')
      return
    }
    Taro.navigateTo({
      url: '/me/profile/detail/index'
    })
  }

  async function handleSwitchRole() {
    try {
      const newRole = primaryRole === 'coach' ? 'student' : 'coach'
      await authService.switchRole(newRole)
      Taro.showToast({
        title: newRole === 'coach' ? '已切换到教练端' : '已切换到学员端',
        icon: 'success'
      })
      setTimeout(() => {
        const targetUrl = newRole === 'coach' ? '/coach/overview' : '/pages/index/index'
        Taro.reLaunch({ url: targetUrl }).catch(() => {
          Taro.redirectTo({ url: targetUrl }).catch(() => {
            Taro.navigateTo({ url: targetUrl }).catch((error) => {
              console.error('[profile] switch role:', error)
              Taro.showToast({ title: '切换后跳转失败', icon: 'none' })
            })
          })
        })
      }, 500)
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || '切换失败',
        icon: 'none'
      })
    }
  }

  function handleJoinBetaGroup() {
    Taro.previewImage({
      current: STUDENT_BETA_GROUP_IMAGE,
      urls: [STUDENT_BETA_GROUP_IMAGE],
    }).catch((error) => {
      console.error('[profile] join beta group:', error)
      Taro.showToast({ title: '打开内测群失败', icon: 'none' })
    })
  }

  const themeIconClass = useMemo(() => {
    return isDark ? 'icon-wanshang' : 'icon-zaoshang'
  }, [isDark])

  function handleThemeToggle() {
    toggleTheme()
    Taro.showToast({
      title: isDark ? '已切换为浅色模式' : '已切换为深色模式',
      icon: 'none',
      duration: 1500
    })
  }

  const trainingDataSummary = profileStats.monthDays === null
    ? '训练日历、每月统计和力量变化'
    : profileStats.monthDays > 0
      ? `本月 ${profileStats.monthDays} 天 · ${profileStats.monthSets ?? 0} 组`
      : '本月还没有训练记录'

  const renderRow = (key: string, title: string, desc: string, onClick: () => void, badge?: string, open?: boolean) => (
    <View key={key} className='me-row' hoverClass='me-row--pressed' hoverStayTime={60} onClick={onClick} ariaRole='button'>
      <View className='me-row__copy'>
        <Text className='me-row__title'>{title}</Text>
        <Text className='me-row__desc'>{desc}</Text>
      </View>
      {badge ? <Text className='me-row__badge'>{badge}</Text> : null}
      <Text className={`me-row__arrow ${open ? 'me-row__arrow--open' : ''}`}>›</Text>
    </View>
  )

  // Custom navigation bar: start the header below WeChat's capsule.
  const capsule = getCapsuleLayout()
  const bodyTop = `${capsule.top + capsule.height + 12}px`

  return (
    <PageThemeRoot>
    <View className={`me-page ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
      <View className='me-page__body' style={{ paddingTop: bodyTop }}>
        <View className='me-head'>
          <View className='me-head__avatar' onClick={handleViewProfile} ariaRole='button' ariaLabel='查看个人资料'>
            {user?.avatar_url ? (
              <Image className='me-head__avatar-img' src={user.avatar_url} mode='aspectFill' />
            ) : (
              <Text className='me-head__avatar-text'>
                {isAuthenticated
                  ? String(user?.real_name || user?.nickname || user?.phone || '?').substring(0, 1)
                  : '登'}
              </Text>
            )}
          </View>
          <View className='me-head__copy'>
            <View className='me-head__name-row'>
              <Text className='me-head__name'>{displayName}</Text>
              <ClTag>{roleBadgeText}</ClTag>
            </View>
            {isAuthenticated ? (
              <Text className='me-head__meta' onClick={handleProfileSettings}>
                {user?.phone ? `${user.phone} · ` : ''}编辑资料 · {points} 积分 ›
              </Text>
            ) : (
              <Text className='me-head__meta'>{displaySubtitle}</Text>
            )}
          </View>
          <View className='me-head__theme' onClick={handleThemeToggle} ariaRole='button' ariaLabel={isDark ? '切换为浅色模式' : '切换为深色模式'}>
            <Text className={`iconfont ${themeIconClass}`} />
          </View>
        </View>

        {!isAuthenticated ? (
          <View className='me-guest'>
            <ClButton block onClick={() => openLogin('/me/profile/index')}>登录 / 注册</ClButton>
          </View>
        ) : null}

        <View className='me-stats'>
          {statMenus.map((item) => (
            <View key={item.key} className='me-stats__item' hoverClass='me-stats__item--pressed' hoverStayTime={60} onClick={() => handleMenuClick(item)} ariaRole='button'>
              <Text className='me-stats__value cl-num'>
                {isAuthenticated ? item.value : <Text className='me-stats__empty'>-</Text>}
                <Text className='me-stats__unit'> {item.unit}</Text>
              </Text>
              <Text className='me-stats__label'>{item.label}</Text>
            </View>
          ))}
        </View>

        <View className='me-card'>
          {renderRow('training-data', '训练数据', trainingDataSummary, () => handleMenuClick({ key: 'training-data', label: '训练数据', icon: '', path: '/me/training-history/index', requiresAuth: true }))}
          {renderRow(
            'fitness-card',
            '健身资料卡',
            '身高体重、目标和训练频率，教练排计划会用到',
            () => handleMenuClick({ key: 'fitness-card', label: '健身资料卡', icon: '', path: '/me/profile/fitness-card/index', requiresAuth: true }),
            isAuthenticated && profileMissingCount > 0 ? `待完善 ${profileMissingCount} 项` : undefined
          )}
        </View>

        <XPayTrialEntry userId={user?.id} />

        <View className='me-grid'>
          {gridMenus.map((item) => (
            <View key={item.key} className='me-grid__item' hoverClass='me-grid__item--pressed' hoverStayTime={60} onClick={() => handleMenuClick(item)} ariaRole='button' ariaLabel={item.badge ? `${item.label}，${item.badge} 条未读` : item.label}>
              <View className='me-grid__icon'>
                <Text className={`iconfont ${item.icon}`} />
                {item.badge ? <Text className='me-grid__badge cl-num'>{item.badge}</Text> : null}
              </View>
              <Text className='me-grid__label'>{item.label}</Text>
            </View>
          ))}
        </View>

        <View className='me-card'>
          {isAuthenticated
            ? renderRow('account-settings', '账户设置', '密码、账号同步、清除缓存、退出登录', () => handleMenuClick({ key: 'account-settings', label: '账户设置', icon: '', path: '/me/settings/index', requiresAuth: true }))
            : null}
          {renderRow('legal', '关于与协议', `联系我们、文档、${LEGAL_LINKS.length - 3} 份协议与说明`, () => setLegalOpen((open) => !open), undefined, legalOpen)}
          {legalOpen ? (
            <View className='me-legal'>
              {LEGAL_LINKS.map((link) => (
                <Text key={link.url} className='me-legal__link' onClick={() => Taro.navigateTo({ url: link.url })}>{link.label}</Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <BottomNav />
    </View>
    </PageThemeRoot>
  )
}

export default Profile
