import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import './index.scss'
import { Mail } from '@nutui/icons-react-taro'

interface Activity {
  id: string
  userId: string
  nickname: string
  avatarUrl?: string
  type: string
  content: string
  created_at: string
}

function FriendsActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const res = await request<{ activities: Activity[] }>({
        url: '/api/user/friends/activity?limit=20',
        method: 'GET'
      })
      if (res.success && res.data) {
        setActivities(res.data.activities || [])
      }
    } catch (error) {
      console.error('加载好友动态失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadActivities()
  })

  usePullDownRefresh(() => {
    loadActivities().finally(() => Taro.stopPullDownRefresh())
  })

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      'workout': '',
      'pr': '',
      'plan': '',
      'achievement': ''
    }
    return icons[type] || ''
  }

  return (
    <View className='friends-activity-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <Text className='page-title'>好友动态</Text>
            <Text className='page-subtitle'>查看好友的训练动态和成就</Text>
          </View>

          {loading ? (
            <View className='loading-wrap'>
              <Text>加载中...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon'><Mail /></View>
              <Text className='empty-text'>暂无好友动态</Text>
              <Text className='empty-hint'>好友的动态会在这里显示</Text>
            </View>
          ) : (
            <View className='activities-list'>
              {activities.map((activity) => (
                <View key={activity.id} className='activity-item'>
                  <View className='activity-header'>
                    <View className='user-avatar'>
                      <Text>{activity.nickname?.charAt(0) || 'U'}</Text>
                    </View>
                    <View className='activity-user'>
                      <Text className='user-name'>{activity.nickname || '未知用户'}</Text>
                      <Text className='activity-time'>
                        {new Date(activity.created_at).toLocaleString('zh-CN')}
                      </Text>
                    </View>
                    <Text className='activity-icon'>{getActivityIcon(activity.type)}</Text>
                  </View>
                  <Text className='activity-content'>{activity.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default FriendsActivityPage
