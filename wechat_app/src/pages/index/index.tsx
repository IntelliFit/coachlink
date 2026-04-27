import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { Power, Search, Star, User, ShieldCheck, Target, ArrowUp } from '@nutui/icons-react-taro'
import './index.scss'

function Index() {
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
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return '早上好'
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

  const handleLogin = () => {
    Taro.navigateTo({ url: authService.buildLoginUrl('/pages/index/index') })
  }

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

  return (
    <View className='home-page page-with-float-nav'>
      <View className='home-header'>
        <View className='home-header-left'>
          <Text className='home-greeting'>
            {isAuthenticated && userName ? `${greeting}，${userName}` : greeting}
          </Text>
          <Text className='home-date'>{todayDateText}</Text>
        </View>
        <View className='home-header-right'>
          <View className='login-pill' onClick={() => void handleProfileEntry()}>
            <Text className='login-pill-text'>{isAuthenticated ? '个人中心' : '登录'}</Text>
          </View>
        </View>
      </View>

      <View className='home-scroll'>
        <View className='home-hero-card'>
          <View className='hero-card-content'>
            <View className='hero-card-text'>
              <Text className='hero-card-title'>
                {isAuthenticated ? '从首页开始今天的安排' : '开启你的训练之旅'}
              </Text>
              <Text className='hero-card-subtitle'>
                {isAuthenticated
                  ? '你可以从这里进入今日训练、发现教练、排行榜和个人中心。'
                  : '登录后可查看今日训练、成长记录和教练服务。'}
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
              {isAuthenticated ? '从这里选择你接下来要做的事' : '登录后开启你的训练计划'}
            </Text>
          </View>
        </View>

        <View className='home-quick-actions'>
          <Text className='section-title'>快捷入口</Text>
          <View className='quick-actions-grid'>
            <View className='quick-action-item' onClick={() => void handleProtectedNav('/training/today-training')}>
              <View className='quick-action-icon'>
                <Power width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>今日训练</Text>
            </View>
            <View className='quick-action-item' onClick={() => void tryNavigate('/discovery/index')}>
              <View className='quick-action-icon'>
                <Search width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>发现教练</Text>
            </View>
            <View className='quick-action-item' onClick={() => void tryNavigate('/discovery/ranking')}>
              <View className='quick-action-icon'>
                <Star width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>排行榜</Text>
            </View>
            <View className='quick-action-item' onClick={() => void handleProtectedNav('/me/profile/index')}>
              <View className='quick-action-icon'>
                <User width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>个人中心</Text>
            </View>
          </View>
        </View>

        <View className='home-features'>
          <Text className='section-title'>平台亮点</Text>
          <View className='features-list'>
            <View className='feature-item' onClick={() => void tryNavigate('/auth/onboarding')}>
              <View className='feature-icon-wrap'>
                <ShieldCheck width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>靠谱教练</Text>
                <Text className='feature-desc'>资质认证，评价透明</Text>
              </View>
              <Text className='feature-arrow'>→</Text>
            </View>
            <View className='feature-item' onClick={() => void handleProtectedNav('/training/today-training')}>
              <View className='feature-icon-wrap'>
                <Target width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>训练安排</Text>
                <Text className='feature-desc'>登录后从首页自主进入今日训练，不再强制跳转</Text>
              </View>
              <Text className='feature-arrow'>→</Text>
            </View>
            <View className='feature-item' onClick={() => void handleProtectedNav('/me/profile/detail/index')}>
              <View className='feature-icon-wrap'>
                <ArrowUp width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>成长档案</Text>
                <Text className='feature-desc'>记录计划、训练和阶段进展</Text>
              </View>
              <Text className='feature-arrow'>→</Text>
            </View>
          </View>
        </View>
      </View>

      <BottomNav />
    </View>
  )
}

export default Index
