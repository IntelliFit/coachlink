import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { Power, Search, Star, ShieldCheck, Target, ArrowUp } from '@nutui/icons-react-taro'
import './index.scss'

function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userName, setUserName] = useState('')
  const redirectingRef = useRef(false)

  const checkAuth = () => {
    const session = authService.getAuthSession({ normalize: true })
    setIsAuthenticated(session.isAuthenticated)
    setUserName(session.user?.nickname || session.user?.name || '')
    return session
  }

  const redirectAuthenticatedToToday = async () => {
    if (redirectingRef.current) return
    if (!authService.isAuthenticated()) return
    redirectingRef.current = true
    try {
      await Taro.redirectTo({ url: '/training/today-training' })
    } catch {
      try {
        await Taro.reLaunch({ url: '/training/today-training' })
      } catch {
        redirectingRef.current = false
      }
    }
  }

  useDidShow(() => {
    const session = checkAuth()
    if (session.isAuthenticated) {
      void redirectAuthenticatedToToday()
    }
  })

  useEffect(() => {
    const session = checkAuth()
    if (session.isAuthenticated) {
      void redirectAuthenticatedToToday()
    }
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
                {isAuthenticated ? '回到今天要做的事' : '先安全开始，再一步步进阶'}
              </Text>
              <Text className='hero-card-subtitle'>
                {isAuthenticated
                  ? '不用自己在功能里乱找，先看今日路径、完成训练，再决定是否学习或找教练。'
                  : '不用先去健身房，也不用一次学完所有知识。先做一次低压力起步。'}
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
              {isAuthenticated ? '今天先完成一个主行动' : '登录后生成你的第一条起步路径'}
            </Text>
          </View>
        </View>

        <View className='home-quick-actions'>
          <Text className='section-title'>先选一个起点</Text>
          <View className='quick-actions-grid'>
            <View className='quick-action-item' onClick={() => void tryNavigate('/content/path/index')}>
              <View className='quick-action-icon'>
                <Star width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>生成路径</Text>
            </View>
            <View className='quick-action-item' onClick={() => void handleProtectedNav('/training/today-training')}>
              <View className='quick-action-icon'>
                <Power width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>登录开始</Text>
            </View>
            <View className='quick-action-item' onClick={() => void tryNavigate('/discovery/index')}>
              <View className='quick-action-icon'>
                <Search width={24} height={24} color='#010101' />
              </View>
              <Text className='quick-action-label'>教练支持</Text>
            </View>
          </View>
        </View>

        <View className='home-features'>
          <Text className='section-title'>这周只抓重点</Text>
          <View className='features-list'>
            <View className='feature-item' onClick={() => void handleProtectedNav('/training/today-training')}>
              <View className='feature-icon-wrap'>
                <ShieldCheck width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>低压力开始</Text>
                <Text className='feature-desc'>家里、宿舍、户外或健身房角落都可以完成第一次训练</Text>
              </View>
              <Text className='feature-arrow'>→</Text>
            </View>
            <View className='feature-item' onClick={() => void handleProtectedNav('/training/today-training')}>
              <View className='feature-icon-wrap'>
                <Target width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>今日主行动</Text>
                <Text className='feature-desc'>先完成今天最重要的一件事，再看学习内容和进阶工具</Text>
              </View>
              <Text className='feature-arrow'>→</Text>
            </View>
            <View className='feature-item' onClick={() => void tryNavigate('/discovery/index')}>
              <View className='feature-icon-wrap'>
                <ArrowUp width={24} height={24} color='#CF6D4E' />
              </View>
              <View className='feature-info'>
                <Text className='feature-title'>卡住再找人</Text>
                <Text className='feature-desc'>动作不确定、怕进健身房、练了没效果，再去找对应教练支持</Text>
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
