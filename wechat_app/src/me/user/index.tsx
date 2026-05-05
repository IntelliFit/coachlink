import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { studentService } from '@/services/studentService'
import { request } from '@/utils/request'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const FITNESS_LEVEL_LABEL_MAP: Record<string, string> = {
  beginner: '零基础',
  novice: '入门',
  intermediate: '进阶',
  advanced: '高阶',
  elite: '精英 / 职业'
}

interface UserStats {
  totalWorkouts: number
  streakDays: number
  totalVolume: number
  prCount: number
}

interface FriendStatus {
  status: 'none' | 'pending' | 'friends'
  isSender?: boolean
}

interface FriendsListData {
  friends: Array<{
    userId: string
  }>
}

interface PendingFriendsData {
  requests: Array<{
    requester: {
      userId: string
    }
  }>
}

export default function UserProfilePage() {
  const router = useRouter()
  const userId = router.params.userId as string
  
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [friendStatus, setFriendStatus] = useState<FriendStatus>({ status: 'none' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      // 并行加载用户资料、统计和好友状态
      const [profileRes, statsRes, friendsRes, pendingRes] = await Promise.all([
        studentService.getStudentProfile(userId),
        request<UserStats>({ url: '/api/user/get-student-stats', method: 'POST', data: { userId } }),
        request<FriendsListData>({ url: '/api/user/friends', method: 'GET' }),
        request<PendingFriendsData>({ url: '/api/user/friends/pending', method: 'GET' })
      ])

      if (profileRes?.profile) {
        setProfile(profileRes.profile)
      }
      if (statsRes?.data) {
        setStats(statsRes.data)
      }

      const isFriend = !!friendsRes?.data?.friends?.some((friend) => friend.userId === userId)
      const hasIncomingPending = !!pendingRes?.data?.requests?.some((item) => item.requester?.userId === userId)

      if (isFriend) {
        setFriendStatus({ status: 'friends' })
      } else if (hasIncomingPending) {
        setFriendStatus({ status: 'pending', isSender: false })
      } else {
        setFriendStatus({ status: 'none' })
      }
    } catch (error) {
      console.error('加载用户数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFriend = async () => {
    try {
      const res = await request({
        url: '/api/user/friends/request',
        method: 'POST',
        data: { targetUserId: userId }
      })

      if (!res.success) {
        Taro.showToast({ title: res.message || '发送失败', icon: 'none' })
        return
      }

      Taro.showToast({ title: '好友请求已发送', icon: 'success' })
      setFriendStatus({ status: 'pending', isSender: true })
    } catch (error) {
      Taro.showToast({ title: '发送失败', icon: 'none' })
    }
  }

  const getFriendButtonText = () => {
    switch (friendStatus.status) {
      case 'friends':
        return '已是好友'
      case 'pending':
        return friendStatus.isSender ? '等待确认' : '待处理请求'
      default:
        return '加好友'
    }
  }

  if (loading) {
    return (
      <View className='user-profile-page'>
        <View className="loading"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  return (
    <View className='user-profile-page'>
      <ScrollView className='page-scroll' scrollY>
        {/* 用户信息卡片 */}
        <View className='profile-card'>
          <View className='avatar-wrapper'>
            {profile?.avatar_url ? (
              <Image className='avatar' src={profile.avatar_url} mode='aspectFill' />
            ) : (
              <View className='avatar-placeholder'>
                <Text>{(profile?.nickname || 'U').charAt(0)}</Text>
              </View>
            )}
          </View>
          <Text className='nickname'>{profile?.nickname || '未命名用户'}</Text>
          {profile?.fitness_goal && (
            <Text className='goal'>目标: {profile.fitness_goal}</Text>
          )}
          
          {/* 好友操作按钮 */}
          <View 
            className={`friend-btn ${friendStatus.status}`}
            onClick={friendStatus.status === 'none' ? handleAddFriend : undefined}
          >
            <Text>{getFriendButtonText()}</Text>
          </View>
        </View>

        {/* 训练统计 */}
        {stats && (
          <View className='stats-card'>
            <Text className='card-title'>训练统计</Text>
            <View className='stats-grid'>
              <View className='stat-item'>
                <Text className='stat-value'>{stats.totalWorkouts}</Text>
                <Text className='stat-label'>总训练次数</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{stats.streakDays}</Text>
                <Text className='stat-label'>连续训练(天)</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{stats.totalVolume}</Text>
                <Text className='stat-label'>总容量(kg)</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>{stats.prCount}</Text>
                <Text className='stat-label'>PR记录</Text>
              </View>
            </View>
          </View>
        )}

        {/* 健身档案 */}
        {profile && (
          <View className='info-card'>
            <Text className='card-title'>健身档案</Text>
            <View className='info-list'>
              {profile.height && profile.weight && (
                <View className='info-item'>
                  <Text className='info-label'>身高/体重</Text>
                  <Text className='info-value'>{profile.height}cm / {profile.weight}kg</Text>
                </View>
              )}
              {profile.fitness_level && (
                <View className='info-item'>
                  <Text className='info-label'>健身水平</Text>
                  <Text className='info-value'>{FITNESS_LEVEL_LABEL_MAP[profile.fitness_level] || profile.fitness_level}</Text>
                </View>
              )}
              {profile.age && (
                <View className='info-item'>
                  <Text className='info-label'>年龄</Text>
                  <Text className='info-value'>{profile.age}岁</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
