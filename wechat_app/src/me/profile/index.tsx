import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import { coachService } from '@/services/coach/coachService'
import { studentService } from '@/services/studentService'
import './index.scss'

interface MenuItem {
  key: string
  label: string
  icon: string
  iconBg: string
  path?: string
  action?: () => void
  badge?: string
  requiresAuth?: boolean
}

function Profile() {
  const { isDark, toggleTheme } = useTheme()
  const [user, setUser] = useState<any>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const openLogin = useCallback((returnTo = '/me/profile/index') => {
    const url = authService.buildLoginUrl(returnTo)
    Taro.navigateTo({ url }).catch((navigateErr) => {
      console.error('[profile] navigateTo login 失败:', navigateErr)
      Taro.redirectTo({ url }).catch((redirectErr) => {
        console.error('[profile] redirectTo login 失败:', redirectErr)
        Taro.reLaunch({ url }).catch((relaunchErr) => {
          console.error('[profile] reLaunch login 失败:', relaunchErr)
        })
      })
    })
  }, [])

  const loadCurrentUser = useCallback(async () => {
    const session = authService.getAuthSession({ normalize: true })
    const currentUser = session.user

    setIsAuthenticated(session.isAuthenticated)

    if (session.isAuthenticated && session.isCoach && session.primaryRole === 'coach') {
      Taro.reLaunch({ url: '/coach/my-profile' })
        .catch((relaunchErr) => {
          console.error('[profile] reLaunch coach my-profile 失败:', relaunchErr)
          Taro.redirectTo({ url: '/coach/my-profile' })
            .catch((redirectErr) => {
              console.error('[profile] redirectTo coach my-profile 失败:', redirectErr)
            })
        })
      return
    }
    setUser(currentUser)

    if (!session.isAuthenticated || !session.userId) {
      setCoachId(null)
      return
    }

    if (currentUser?.is_coach && currentUser?.id) {
      void loadCoachId(currentUser.id)
    } else {
      setCoachId(null)
    }

    try {
      const profileRes = await studentService.getStudentProfile(currentUser.id)
      const profile = profileRes?.profile
      if (!profile || typeof profile !== 'object') return

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
    } catch (e) {
      console.error('[profile] sync current user profile:', e)
    }
  }, [])

  useEffect(() => {
    void loadCurrentUser()
  }, [loadCurrentUser])

  useDidShow(() => {
    void loadCurrentUser()
  })

  async function loadCoachId(userId: string) {
    try {
      const res = await coachService.getCoach({ userId })
      if (res?.coach?.id) {
        setCoachId(res.coach.id)
      }
    } catch (e) {
      console.error('[profile] load coach id:', e)
    }
  }

  const points = user?.points ?? 0
  const primaryRole = user?.primary_role === 'coach' ? 'coach' : 'student'
  const isCoach = !!user?.is_coach
  const canSwitchRole = isAuthenticated && isCoach
  const displayName = isAuthenticated
    ? String(user?.nickname || user?.real_name || user?.phone || 'CoachLink 学员')
    : '未登录'
  const displaySubtitle = isAuthenticated
    ? String(user?.phone || '已登录，可同步训练、会员与消息')
    : '登录后同步训练计划、会员、消息与积分'
  const roleBadgeText = isAuthenticated ? (primaryRole === 'coach' ? '教练身份' : '学员身份') : '游客模式'
  const statusBadgeText = isAuthenticated ? `${points}积分` : '点击登录'

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
        } catch (e) {
          console.error('[profile] load coach id:', e)
        }
      }

      if (targetCoachId) {
        Taro.navigateTo({
          url: `/coach/profile/[id]?id=${targetCoachId}&edit=1`
        }).catch((err) => {
          console.error('导航失败:', err)
          Taro.showToast({
            title: '页面跳转失败',
            icon: 'none',
            duration: 2000
          })
        })
      } else {
        Taro.showToast({
          title: '获取教练信息失败',
          icon: 'none'
        })
      }
    } else {
      Taro.navigateTo({
        url: '/me/profile/edit/index'
      }).catch(() => {
        Taro.showToast({ title: '页面跳转失败', icon: 'none' })
      })
    }
  }

  const topMenus: MenuItem[] = [
    {
      key: 'current-plan',
      label: '全部计划',
      icon: 'icon-a-Trainingplan',
      iconBg: '#29C3A3',
      path: '/me/plan-history/index',
      requiresAuth: true
    },
    {
      key: 'my-coaches',
      label: '我的教练',
      icon: 'icon-coachline_line',
      iconBg: '#5C8DFF',
      path: '/me/my-coaches/index',
      requiresAuth: true
    },
    {
      key: 'my-membership',
      label: '我的会员',
      icon: 'icon-vips',
      iconBg: '#FFA940',
      path: '/me/membership/index',
      requiresAuth: true
    },
    {
      key: 'training-history',
      label: '训练记录',
      icon: 'icon-training_history',
      iconBg: '#FF7A7A',
      path: '/me/training-history/index',
      requiresAuth: true
    }
  ]

  const middleMenus: MenuItem[] = [
    {
      key: 'my-friends',
      label: '我的好友',
      icon: 'icon-friends-o',
      iconBg: '#7DC8FF',
      path: '/me/friends/index',
      requiresAuth: true
    },
    {
      key: 'action-library',
      label: '我的动作库',
      icon: 'icon-dumbbell',
      iconBg: '#8FD3FE',
      path: '/me/action-lib/index',
      requiresAuth: true
    },
    {
      key: 'knowledge',
      label: '知识库',
      icon: 'icon-knowledge',
      iconBg: '#B39DDB',
      path: '/content/knowledge',
      requiresAuth: true
    },
    {
      key: 'plan-library',
      label: '我的计划库',
      icon: 'icon-a-Trainingplan',
      iconBg: '#FFD666',
      path: '/me/plan-lib/index',
      requiresAuth: true
    },
    {
      key: 'ranking',
      label: '排行榜',
      icon: 'icon-ranking',
      iconBg: '#26A69A',
      path: '/discovery/ranking',
      requiresAuth: true
    },
    {
      key: 'purchase-history',
      label: '购买记录',
      icon: 'icon-goumaijilu',
      iconBg: '#722ed1',
      path: '/me/purchase-history/index',
      requiresAuth: true
    }
  ]

  const extraMenus: MenuItem[] = isAuthenticated
    ? [
        ...(canSwitchRole
          ? [{
              key: 'switch-role',
              label: primaryRole === 'coach' ? '切换到学员端' : '切换到教练端',
              icon: primaryRole === 'coach' ? 'icon-shenqingquanxian' : 'icon-coachline_line',
              iconBg: primaryRole === 'coach' ? '#29C3A3' : '#FFD700',
              action: handleSwitchRole,
              requiresAuth: true
            }]
          : []),
        ...(!isCoach ? [{
          key: 'apply-coach',
          label: '申请成为教练',
          icon: 'icon-shenqingquanxian',
          iconBg: '#FFD700',
          path: '/coach/application'
        }] : []),
        {
          key: 'account-settings',
          label: '账户设置',
          icon: 'icon-account-settings-variant',
          iconBg: '#B0BEC5',
          path: '/me/settings/index',
          requiresAuth: true
        }
      ]
    : [
        {
          key: 'login',
          label: '立即登录',
          icon: 'icon-login',
          iconBg: '#29C3A3',
          action: () => openLogin('/me/profile/index'),
          badge: '推荐'
        },
        {
          key: 'register',
          label: '注册账号',
          icon: 'icon-account-settings-variant',
          iconBg: '#5C8DFF',
          path: '/auth/register'
        },
        {
          key: 'apply-coach',
          label: '申请成为教练',
          icon: 'icon-shenqingquanxian',
          iconBg: '#FFD700',
          path: '/auth/onboarding'
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
      Taro.navigateTo({ url: item.path }).catch((err) => {
        console.error('导航失败:', err)
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
        Taro.reLaunch({ url: targetUrl })
          .catch((relaunchErr) => {
            console.error('[profile] switch role reLaunch 失败:', relaunchErr)
            Taro.redirectTo({ url: targetUrl })
              .catch((redirectErr) => {
                console.error('[profile] switch role redirectTo 失败:', redirectErr)
                Taro.navigateTo({ url: targetUrl })
                  .catch((navigateErr) => {
                    console.error('[profile] switch role navigateTo 失败:', navigateErr)
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

  const themeIconClass = useMemo(() => {
    return isDark ? 'icon-wanshang' : 'icon-zaoshang'
  }, [isDark])

  function handleThemeToggle() {
    toggleTheme()
    Taro.showToast({
      title: isDark ? '已切换为浅色模式' : '已切换为深色模式',
      icon: 'none',
      duration: 1500,
    })
  }

  async function handleLogout() {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await authService.logout()
            Taro.showToast({
              title: '已退出登录',
              icon: 'success'
            })
            setTimeout(() => {
              Taro.reLaunch({ url: '/auth/login' })
            }, 1000)
          } catch (error: any) {
            console.error('退出登录失败:', error)
            Taro.showToast({
              title: '退出失败',
              icon: 'error'
            })
          }
        }
      }
    })
  }


  return (
    <View className='profile-page'>
      <View className='myContainer'>
        {/* 用户档案卡片 */}
        <View className='profile-card'>
          <View className='profile-card-header'>
            <View className='avatar-wrapper' onClick={handleViewProfile}>
              <View className='avatar-container'>
                {user?.avatar_url ? (
                  <Image
                    className='avatar'
                    src={user.avatar_url}
                    mode='aspectFill'
                  />
                ) : (
                  <View className='avatar-placeholder'>
                    <Text className='avatar-text'>
                      {isAuthenticated
                        ? String(user?.real_name || user?.nickname || user?.phone || '?').substring(0, 1)
                        : '登'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View className='profile-info'>
              <View className='profile-name-row'>
                <Text className='profile-name'>{displayName}</Text>
                <Text className='profile-tag'>{roleBadgeText}</Text>
              </View>
              <Text className='profile-edit-link' onClick={handleProfileSettings}>
                编辑资料 ›
              </Text>
            </View>
            <View className='profile-header-right'>
              <View
                className='theme-toggle-btn-round'
                onClick={handleThemeToggle}
              >
                <Text className={`iconfont ${themeIconClass} theme-toggle-icon`} />
              </View>
            </View>
          </View>

          {/* 功能入口行 */}
          <View className='profile-stats-row'>
            <View className='profile-stat-item' onClick={() => handleMenuClick(topMenus[0])}>
              <Text className='profile-stat-value'>0</Text>
              <Text className='profile-stat-label'>{topMenus[0].label}</Text>
            </View>
            <View className='profile-stat-item' onClick={() => handleMenuClick(middleMenus[1])}>
              <Text className='profile-stat-value'>0</Text>
              <Text className='profile-stat-label'>{middleMenus[1].label}</Text>
            </View>
            <View className='profile-stat-item' onClick={() => handleMenuClick(topMenus[3])}>
              <Text className='profile-stat-value'>0</Text>
              <Text className='profile-stat-label'>{topMenus[3].label}</Text>
            </View>
          </View>
        </View>

        {/* 会员卡片 */}
        <View className='membership-card' onClick={() => handleMenuClick(topMenus[2])}>
          <View className='membership-card-header'>
            <Text className='membership-card-title'>我的会员</Text>
            <Text className='membership-card-badge'>学员</Text>
          </View>
          <View className='membership-progress-row'>
            <Text className='membership-progress-label'>训练进度</Text>
            <Text className='membership-progress-value'>0/0</Text>
          </View>
          <View className='membership-progress-bar'>
            <View className='membership-progress-fill' style={{ width: '0%' }} />
          </View>
          <View className='membership-points-row'>
            <Text className='membership-points-label'>积分</Text>
            <Text className='membership-points-value'>0</Text>
          </View>
        </View>

        {/* 未登录提示 */}
        {!isAuthenticated && (
          <View className='guest-notice-card'>
            <Text className='guest-notice-title'>登录后解锁个人训练数据</Text>
            <Text className='guest-notice-desc'>
              全部计划、我的会员、消息中心、购买记录等个人数据，会在登录后自动同步到这里。
            </Text>
          </View>
        )}

        {/* 更多功能列表 */}
        <View className='menu-list-card'>
          {middleMenus.map((item) => (
            <View
              key={item.key}
              className='menu-list-item'
              onClick={() => handleMenuClick(item)}
            >
              <View className='menu-list-left'>
                <View className='menu-list-icon' style={{ '--icon-color': item.iconBg } as any}>
                  <Text className={`iconfont ${item.icon}`} />
                </View>
                <Text className='menu-list-label'>{item.label}</Text>
              </View>
              <Text className='menu-list-arrow'>›</Text>
            </View>
          ))}
        </View>

        {/* 额外功能列表 */}
        <View className='menu-list-card'>
          {extraMenus.map((item) => (
            <View
              key={item.key}
              className='menu-list-item'
              onClick={() => handleMenuClick(item)}
            >
              <View className='menu-list-left'>
                <View className='menu-list-icon' style={{ '--icon-color': item.iconBg } as any}>
                  <Text className={`iconfont ${item.icon}`} />
                </View>
                <Text className='menu-list-label'>{item.label}</Text>
              </View>
              <View className='menu-list-right'>
                {item.badge && (
                  <View className='list-badge'>
                    <Text className='list-badge-text'>{item.badge}</Text>
                  </View>
                )}
                <Text className='menu-list-arrow'>›</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 退出登录 */}
        {isAuthenticated && (
          <View className='logout-section'>
            <View className='logout-btn' onClick={handleLogout}>
              <Text className='logout-text'>退出登录</Text>
            </View>
          </View>
        )}

        {/* 底部链接 */}
        <View className='profile-footer-links'>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/about/index' })}>关于</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/disclaimer/index' })}>免责声明</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/contact/index' })}>联系</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/docs/index' })}>文档</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/auth/onboarding' })}>入驻说明</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/protection-of-consumer/index' })}>消费者权益保护</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/terms/index' })}>用户服务协议</Text>
          <Text className='footer-dot'>·</Text>
          <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/platform-agreement/index' })}>平台入驻协议</Text>
        </View>
      </View>

      <BottomNav />
    </View>
  )
}

export default Profile
