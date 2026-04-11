import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authService } from '@/services/authService'
import { coachService } from '@/services/coach/coachService'
import BottomNav from '@/components/BottomNav'
import './index.scss'

function CoachProfile() {
  const [message, setMessage] = useState('正在跳转...')

  useEffect(() => {
    void resolveAndRedirect()
  }, [])

  async function resolveAndRedirect() {
    const params = Taro.getCurrentInstance().router?.params || {}
    const requestedId = typeof params.id === 'string' ? params.id : ''
    const edit = typeof params.edit === 'string' ? params.edit : ''

    let coachId = requestedId

    if (!coachId) {
      const token = Taro.getStorageSync('token')
      if (!token) {
        const loginUrl = '/auth/login?returnTo=' + encodeURIComponent('/coach/my-profile')
        Taro.redirectTo({ url: loginUrl }).catch(() => {
          Taro.reLaunch({ url: loginUrl })
        })
        return
      }

      try {
        const currentUser = authService.getCurrentUser()
        if (!currentUser?.id) {
          setMessage('未找到当前用户信息')
          return
        }
        const res = await coachService.getCoach({ userId: currentUser.id })
        if (!res?.coach?.id) {
          setMessage('未找到教练资料')
          return
        }
        coachId = res.coach.id
      } catch (e) {
        console.error('[coach/profile] resolve current coach:', e)
        setMessage('获取教练资料失败')
        return
      }
    }

    const query = [`id=${encodeURIComponent(coachId)}`]
    if (edit) {
      query.push(`edit=${encodeURIComponent(edit)}`)
    }
    const targetUrl = `/coach/profile/[id]?${query.join('&')}`

    try {
      await Taro.redirectTo({ url: targetUrl })
    } catch (redirectErr) {
      console.error('[coach/profile] redirectTo dynamic profile 失败:', redirectErr)
      try {
        await Taro.reLaunch({ url: targetUrl })
      } catch (relaunchErr) {
        console.error('[coach/profile] reLaunch dynamic profile 失败:', relaunchErr)
        setMessage('跳转教练主页失败')
      }
    }
  }

  return (
    <View className='coach-profile-page'>
      <View className='loading-wrap'>
        <Text>{message}</Text>
      </View>
      <BottomNav />
    </View>
  )
}

export default CoachProfile
