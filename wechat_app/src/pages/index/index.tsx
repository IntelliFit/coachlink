import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import { Power } from '@nutui/icons-react-taro'
import TodayTrainingScreen from '@/training/today-training/TodayTrainingScreen'
import './index.scss'

const STUDENT_HOME_PATH = '/pages/index/index'
const LEGACY_TRAINING_PATH = '/training/today-training'

function isStudentHomePath(url: string) {
  const pathOnly = (url || '').split('?')[0]
  return pathOnly === STUDENT_HOME_PATH || pathOnly === LEGACY_TRAINING_PATH
}

function resolveHomeMode(): 'guest' | 'student' | 'coach' {
  const session = authService.getAuthSession({ normalize: true })
  if (!session.isAuthenticated) return 'guest'
  if (session.isCoach && session.primaryRole === 'coach') return 'coach'
  return 'student'
}

function Index() {
  const [mode, setMode] = useState<'guest' | 'student' | 'coach'>(() => resolveHomeMode())

  const checkAuth = () => {
    setMode(resolveHomeMode())
  }

  useDidShow(() => {
    checkAuth()
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (mode === 'coach') {
      void Taro.reLaunch({ url: '/coach/overview' })
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'student') return
    let cancelled = false
    void (async () => {
      try {
        const session = authService.getAuthSession({ normalize: true })
        const targetUrl = await studentOnboardingService.resolvePostLoginUrl({
          loggedInUser: session.user,
          fallbackUrl: STUDENT_HOME_PATH
        })
        if (cancelled) return
        if (!isStudentHomePath(targetUrl)) {
          await Taro.reLaunch({ url: targetUrl })
        }
      } catch (e) {
        console.error('[index] onboarding gate failed:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode])

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

  if (mode === 'coach') {
    return (
      <View className='home-page page-with-float-nav'>
        <BottomNav />
      </View>
    )
  }

  if (mode === 'student') {
    return <TodayTrainingScreen />
  }

  return (
    <View className='home-page page-with-float-nav'>
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
