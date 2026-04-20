import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { Power } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'
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

  useEffect(() => {
    // 已登录用户自动跳转到主要界面
    if (isAuthenticated) {
      const redirect = async () => {
        try {
          const targetUrl = await studentOnboardingService.resolvePostLoginUrl({
            loggedInUser: authService.getAuthSession({ normalize: true }).user,
            fallbackUrl: '/training/today-training'
          })
          Taro.reLaunch({ url: targetUrl })
        } catch (e) {
          console.error('[index] redirect failed:', e)
        }
      }
      // 稍微延迟避免闪烁
      const timer = setTimeout(() => {
        redirect()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated])

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

  const handleNavTo = (url: string) => {
    Taro.navigateTo({ url })
  }

  // If authenticated, we'll redirect soon, but show a brief loading/skeleton
  if (isAuthenticated) {
    return (
      <View className='home-page page-with-float-nav'>
        <View className='home-loading'>
          <LoadingSpinner size={48} />
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className='home-page page-with-float-nav'>
      {/* Header */}
      <View className='home-header'>
        <View className='home-header-left'>
          <Text className='home-greeting'>{greeting}</Text>
          <Text className='home-date'>{todayDateText}</Text>
        </View>
        <View className='home-header-right'>
          <View className='login-pill' onClick={handleLogin}>
            <Text className='login-pill-text'>登录</Text>
          </View>
        </View>
      </View>

      <View className='home-scroll'>
        {/* Daily Goal Hero Card */}
        <View className='home-hero-card'>
          <View className='hero-card-content'>
            <View className='hero-card-text'>
              <Text className='hero-card-title'>开启你的训练之旅</Text>
              <Text className='hero-card-subtitle'>登录后可查看今日训练计划</Text>
            </View>
            <View className='hero-card-icon-wrap'>
              <Power width={28} height={28} color='#CF6D4E' />
            </View>
          </View>
          <View className='hero-card-progress'>
            <View className='progress-track'>
              <View className='progress-fill' style={{ width: '0%' }} />
            </View>
            <Text className='progress-label'>今日完成度 0%</Text>
          </View>
        </View>

        {/* Promo / Insight Card */}
        <View className='home-promo-card'>
          <Text className='promo-card-title'>运动后拉伸</Text>
          <Text className='promo-card-subtitle'>有助于提升睡眠质量</Text>
          <View className='promo-card-actions'>
            <View className='promo-btn promo-btn-outline' onClick={() => handleNavTo('/auth/onboarding')}>
              <Text className='promo-btn-text'>了解更多</Text>
            </View>
            <View className='promo-btn promo-btn-solid' onClick={() => handleNavTo('/auth/onboarding')}>
              <Text className='promo-btn-text'>立即开始</Text>
            </View>
          </View>
        </View>
      </View>

      <BottomNav />
    </View>
  )
}

export default Index
