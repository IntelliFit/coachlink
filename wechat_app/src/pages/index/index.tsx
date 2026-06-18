import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { Power, Search, Setting, Book, ShieldCheck, Target, ArrowUp } from '@nutui/icons-react-taro'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

function Index() {
  const { effectiveTheme } = useTheme()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userName, setUserName] = useState('')

  const checkAuth = () => {
    const session = authService.getAuthSession({ normalize: true })
    setIsAuthenticated(session.isAuthenticated)
    setUserName(session.user?.nickname || session.user?.name || '')
  }

  useDidShow(() => {
    checkAuth()
  })

  useEffect(() => {
    checkAuth()
    openCoachLinkShareMenu()
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return '上午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  }, [])

  const todayDateText = useMemo(() => {
    const now = new Date()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const month = now.getMonth() + 1
    const date = now.getDate()
    const weekday = weekdays[now.getDay()]
    return `${month}月${date}日 · ${weekday}`
  }, [])

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: 'CoachLink 教链：训练、教练与工具都在这里',
        path: buildSharePath('/pages/index/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const tryNavigate = async (url: string) => {
    try {
      await Taro.navigateTo({ url })
      return
    } catch {}

    try {
      await Taro.redirectTo({ url })
      return
    } catch {}

    await Taro.reLaunch({ url })
  }

  const handleLogin = () => {
    Taro.navigateTo({ url: authService.buildLoginUrl('/pages/index/index') })
  }

  const handleProtectedNav = async (url: string) => {
    if (!authService.isAuthenticated()) {
      await Taro.navigateTo({ url: authService.buildLoginUrl(url) })
      return
    }
    await tryNavigate(url)
  }

  const handleProfileEntry = async () => {
    if (isAuthenticated) {
      await tryNavigate('/me/profile/index')
      return
    }
    handleLogin()
  }

  const primaryActions = [
    {
      key: 'training',
      label: '开始训练',
      icon: <Power width={24} height={24} color='#010101' />,
      onClick: () => handleProtectedNav('/training/today-training')
    },
    {
      key: 'coach',
      label: '找教练',
      icon: <Search width={24} height={24} color='#010101' />,
      onClick: () => tryNavigate('/discovery/index')
    },
    {
      key: 'knowledge',
      label: '查知识',
      icon: <Book width={24} height={24} color='#010101' />,
      onClick: () => tryNavigate('/content/knowledge')
    },
    {
      key: 'toolbox',
      label: '用工具',
      icon: <Setting width={24} height={24} color='#010101' />,
      onClick: () => tryNavigate('/me/toolbox/index')
    }
  ]

  const featureItems = [
    {
      key: 'onboarding',
      title: '先找到适合你的路径',
      desc: '目标、水平和习惯不同，进入平台后的第一步也应该不同。',
      icon: <ShieldCheck width={24} height={24} color='#CF6D4E' />,
      onClick: () => tryNavigate('/auth/onboarding')
    },
    {
      key: 'today-training',
      title: '把今天这一练顺畅记下来',
      desc: '直接进入今日训练，减少记录阻力，让训练过程更愿意打开 CoachLink。',
      icon: <Target width={24} height={24} color='#CF6D4E' />,
      onClick: () => handleProtectedNav('/training/today-training')
    },
    {
      key: 'profile',
      title: '让成长数据慢慢积累起来',
      desc: '计划、训练记录、购买服务和消息都会沉淀到个人资产里。',
      icon: <ArrowUp width={24} height={24} color='#CF6D4E' />,
      onClick: () => handleProtectedNav('/me/profile/detail/index')
    }
  ]

  return (
    <View className={`home-page page-with-float-nav theme-${effectiveTheme}`}>
      <View className='home-header'>
        <View className='home-header-left'>
          <Text className='home-greeting'>
            {isAuthenticated && userName ? `${greeting}，${userName}` : greeting}
          </Text>
          <Text className='home-date'>{todayDateText}</Text>
        </View>
        <View className='home-header-right'>
          <View className='login-pill' onClick={() => void handleProfileEntry()}>
            <Text className='login-pill-text'>{isAuthenticated ? '进入我的' : '去登录'}</Text>
          </View>
        </View>
      </View>

      <View className='home-scroll'>
        <View className='home-hero-card'>
          <View className='hero-card-content'>
            <View className='hero-card-text'>
              <Text className='hero-card-title'>
                {isAuthenticated ? '今天先完成一件最重要的事' : '先从最想解决的那个训练需求开始'}
              </Text>
              <Text className='hero-card-subtitle'>
                {isAuthenticated
                  ? '训练、找教练、查知识和用工具都在这里，但先把你此刻最需要的一步走清楚。'
                  : '不管你是刚开始训练，还是想找人带、查问题、用工具，我们先给你一个明确入口。'}
              </Text>
            </View>
            <View className='hero-card-icon-wrap'>
              <Power width={28} height={28} color='#CF6D4E' />
            </View>
          </View>
          <View className='hero-card-progress'>
            <View className='progress-track'>
              <View className='progress-fill' style={{ width: '0%' }} />
            </View>
            <Text className='progress-label'>
              {isAuthenticated ? '从今日训练或当前目标继续' : '登录后同步训练、服务和个人数据'}
            </Text>
          </View>
        </View>

        <View className='home-quick-actions'>
          <Text className='section-title'>现在就做</Text>
          <View className='quick-actions-grid'>
            {primaryActions.map((item) => (
              <View key={item.key} className='quick-action-item' onClick={() => void item.onClick()}>
                <View className='quick-action-icon'>
                  {item.icon}
                </View>
                <Text className='quick-action-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='home-features'>
          <Text className='section-title'>接下来会更顺</Text>
          <View className='features-list'>
            {featureItems.map((item) => (
              <View key={item.key} className='feature-item' onClick={() => void item.onClick()}>
                <View className='feature-icon-wrap'>
                  {item.icon}
                </View>
                <View className='feature-info'>
                  <Text className='feature-title'>{item.title}</Text>
                  <Text className='feature-desc'>{item.desc}</Text>
                </View>
                <Text className='feature-arrow'>›</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomNav />
    </View>
  )
}

export default Index
