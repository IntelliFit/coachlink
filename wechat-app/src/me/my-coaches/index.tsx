import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import { fetchMyCoachSubscriptions, fetchCoachAggregatedInfo } from './service'
import type { QueryCoachSubscription, GetAggregatedInfoResponseDto } from './types'
import CoachCard from './components/CoachCard'
import './index.scss'

type PageState = 'loading' | 'success' | 'empty' | 'error'

export default function MyCoaches() {
  const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([])
  const [aggregatedMap, setAggregatedMap] = useState<Record<string, GetAggregatedInfoResponseDto>>({})
  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(async () => {
    const user = authService.getCurrentUser()
    const studentId = user?.id
    if (!studentId) {
      setPageState('empty')
      setSubscriptions([])
      setErrorMessage('请先登录')
      return
    }

    setPageState('loading')
    setErrorMessage('')
    try {
      const list = await fetchMyCoachSubscriptions(studentId)
      setSubscriptions(list)
      if (list.length === 0) {
        setPageState('empty')
        return
      }
      setPageState('success')

      const map: Record<string, GetAggregatedInfoResponseDto> = {}
      for (const sub of list) {
        try {
          const info = await fetchCoachAggregatedInfo(sub.coach_id)
          if (info) map[sub.coach_id] = info
        } catch (e) {
          console.warn('getAggregatedInfo failed for', sub.coach_id, e)
        }
      }
      setAggregatedMap(map)
    } catch (e) {
      console.error('加载我的教练失败:', e)
      setPageState('error')
      setErrorMessage((e as Error).message || '加载失败，请重试')
      setSubscriptions([])
    }
  }, [])

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const goDiscovery = () => {
    Taro.navigateTo({ url: '/discovery/index' })
  }

  const onDetail = (coachId: string) => {
    Taro.navigateTo({ url: `/discovery/coach-profile?id=${coachId}` })
  }

  const onRenew = (_coachId: string) => {
    if (!_coachId) {
      Taro.showToast({ title: '缺少教练信息', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/me/payment/webview/index?coachId=${encodeURIComponent(_coachId)}&renew=1`
    })
  }

  const openChatWithCoach = useCallback(async (coachId: string, coachName?: string) => {
    const userId = authService.getCurrentUser()?.id
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.navigateTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/me/my-coaches/index')
      })
      return
    }
    if (!coachId) {
      Taro.showToast({ title: '缺少教练信息', icon: 'none' })
      return
    }
    if (coachId === userId) {
      Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
      return
    }

    const safeCoachName = coachName || '教练'
    try {
      const room = await chatService.getChatroom({ members: [userId, coachId] })
      if (room?.id) {
        await Taro.navigateTo({
          url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(safeCoachName)}`
        })
        return
      }
    } catch (error) {
      console.error('[my-coaches] open chat failed:', error)
    }

    await Taro.navigateTo({
      url: `/me/messages/index?coachId=${encodeURIComponent(coachId)}&coachName=${encodeURIComponent(safeCoachName)}`
    })
  }, [])

  const onConsult = (coachId: string) => {
    const coachName = subscriptions.find((item) => item.coach_id === coachId)?.coach?.name || ''
    void openChatWithCoach(coachId, coachName)
  }

  const renderSkeleton = () => (
    <View className='skeleton-list'>
      {[1, 2, 3].map((i) => (
        <View key={i} className='skeleton-card'>
          <View className='skeleton-avatar' />
          <View className='skeleton-content'>
            <View className='skeleton-line skeleton-title' />
            <View className='skeleton-line skeleton-subtitle' />
            <View className='skeleton-line' style={{ width: '80%' }} />
          </View>
        </View>
      ))}
    </View>
  )

  return (
    <View className='my-coaches-page'>
      <View className='page-header'>
        <View className='header-row'>
          <View className='title-section'>
            <Text className='page-title'>我的教练</Text>
            <Text className='page-subtitle'>已订阅的教练列表</Text>
          </View>
          <View className='btn-discovery' onClick={goDiscovery}>
            发现更多
          </View>
        </View>
      </View>

      {pageState === 'loading' && renderSkeleton()}

      {pageState === 'empty' && (
        <View className='empty-state'>
          <Text className='empty-icon'>👤</Text>
          <Text className='empty-text'>{errorMessage || '暂无订阅的教练'}</Text>
          <Text className='empty-hint'>去发现教练页订阅你喜欢的教练</Text>
          <View className='btn-discovery' onClick={goDiscovery} style={{ marginTop: 16 }}>
            <Text>发现教练</Text>
          </View>
        </View>
      )}

      {pageState === 'error' && (
        <View className='error-container'>
          <Text className='error-text'>{errorMessage}</Text>
          <View className='btn-retry' onClick={load}>
            <Text>重试</Text>
          </View>
        </View>
      )}

      {pageState === 'success' && (
        <View className='coaches-list'>
          {subscriptions.map((sub) => (
            <CoachCard
              key={sub.id}
              subscription={sub}
              aggregated={aggregatedMap[sub.coach_id]}
              onDetail={onDetail}
              onRenew={onRenew}
              onConsult={onConsult}
            />
          ))}
        </View>
      )}
    </View>
  )
}
