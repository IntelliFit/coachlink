import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { User } from '@nutui/icons-react-taro'
import { authService } from '@/services/authService'
import { openCoachChat } from '@/utils/coachChat'
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

      const nextMap: Record<string, GetAggregatedInfoResponseDto> = {}
      for (const subscription of list) {
        try {
          const info = await fetchCoachAggregatedInfo(subscription.coach_id)
          if (info) nextMap[subscription.coach_id] = info
        } catch (error) {
          console.warn('getAggregatedInfo failed for', subscription.coach_id, error)
        }
      }
      setAggregatedMap(nextMap)
    } catch (error) {
      console.error('load my coaches failed:', error)
      setPageState('error')
      setErrorMessage((error as Error).message || '加载我的教练失败，请稍后重试')
      setSubscriptions([])
    }
  }, [])

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const goDiscovery = useCallback(() => {
    Taro.navigateTo({ url: '/discovery/index' })
  }, [])

  const onDetail = useCallback((coachId: string) => {
    Taro.navigateTo({ url: `/discovery/coach-profile?id=${coachId}` })
  }, [])

  const onRenew = useCallback((coachId: string) => {
    if (!coachId) {
      Taro.showToast({ title: '无法获取教练信息', icon: 'none' })
      return
    }

    Taro.navigateTo({
      url: `/me/payment/webview/index?coachId=${encodeURIComponent(coachId)}&renew=1`
    })
  }, [])

  const openChatWithCoach = useCallback(async (coachId: string, coachName?: string, coachUserId?: string | null) => {
    const userId = authService.getCurrentUser()?.id
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.navigateTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/me/my-coaches/index')
      })
      return
    }

    if (!coachId) {
      Taro.showToast({ title: '无法获取教练信息', icon: 'none' })
      return
    }

    await openCoachChat({
      currentUserId: userId,
      coachId,
      coachUserId,
      coachName: coachName || '教练',
      fallbackToMessagesList: true
    })
  }, [])

  const onConsult = useCallback((coachId: string) => {
    const coach = subscriptions.find((item) => item.coach_id === coachId)?.coach
    void openChatWithCoach(coachId, coach?.name || '', coach?.user_id || '')
  }, [openChatWithCoach, subscriptions])

  const renderSkeleton = () => (
    <View className='skeleton-list'>
      {[1, 2, 3].map((item) => (
        <View key={item} className='skeleton-card'>
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
          <View className='btn-discovery' onClick={goDiscovery}>
            浏览教练
          </View>
        </View>
      </View>

      {pageState === 'loading' && renderSkeleton()}

      {pageState === 'empty' && (
        <View className='empty-state'>
          <View className='empty-icon'><User /></View>
          <Text className='empty-text'>{errorMessage || '暂时还没有订阅中的教练'}</Text>
          <Text className='empty-hint'>去发现教练页面挑选你喜欢的教练吧。</Text>
          <View className='btn-discovery' onClick={goDiscovery} style={{ marginTop: 16 }}>
            <Text>去发现教练</Text>
          </View>
        </View>
      )}

      {pageState === 'error' && (
        <View className='error-container'>
          <Text className='error-text'>{errorMessage}</Text>
          <View className='btn-retry' onClick={() => void load()}>
            <Text>重新加载</Text>
          </View>
        </View>
      )}

      {pageState === 'success' && (
        <View className='coaches-list'>
          {subscriptions.map((subscription) => (
            <CoachCard
              key={subscription.id}
              subscription={subscription}
              aggregated={aggregatedMap[subscription.coach_id]}
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
