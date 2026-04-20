import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import './index.scss'

interface Friend {
  userId: string
  nickname: string
  avatarUrl?: string
}

interface FriendRequest {
  friendshipId: string
  userId: string
  nickname: string
  avatarUrl?: string
}

function FriendsPage() {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [searchText, setSearchText] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const [friendsRes, requestsRes] = await Promise.all([
        request<{ friends: Friend[] }>({
          url: '/api/user/friends',
          method: 'GET'
        }),
        request<{ requests: FriendRequest[] }>({
          url: '/api/user/friends/pending',
          method: 'GET'
        })
      ])

      if (friendsRes.success && friendsRes.data) {
        setFriends(friendsRes.data.friends || [])
      }
      if (requestsRes.success && requestsRes.data) {
        setRequests(requestsRes.data.requests || [])
      }
    } catch (error) {
      console.error('加载好友数据失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const tab = router.params?.tab
    if (tab === 'requests' || tab === '1') {
      setActiveTab(1)
    }
  }, [router.params?.tab])

  useDidShow(() => {
    loadData()
  })

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh())
  })

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const res = await request<any>({
        url: `/api/user/search?query=${encodeURIComponent(query)}`,
        method: 'GET'
      })
      if (res.success && res.data) {
        setSearchResults(Array.isArray(res.data) ? res.data : [])
      }
    } catch (error) {
      console.error('搜索用户失败:', error)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
    }
  }, [])

  const handleSendRequest = async (targetId: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await request({
        url: '/api/user/friends/request',
        method: 'POST',
        data: { targetUserId: targetId }
      })
      if (res.success) {
        Taro.showToast({ title: '请求已发送', icon: 'success' })
        setSearchResults(prev => prev.filter(u => u.id !== targetId))
      }
    } catch (error) {
      Taro.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRespond = async (friendshipId: string, action: 'accept' | 'reject') => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await request({
        url: '/api/user/friends/respond',
        method: 'POST',
        data: { friendshipId, action }
      })
      if (res.success) {
        Taro.showToast({ 
          title: action === 'accept' ? '已添加好友' : '已拒绝请求', 
          icon: 'success' 
        })
        loadData()
      }
    } catch (error) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    if (actionLoading) return
    const res = await Taro.showModal({
      title: '删除确认',
      content: '确定要删除这位好友吗？'
    })
    if (res.confirm) {
      setActionLoading(true)
      try {
        const result = await request({
          url: `/api/user/friends/${friendId}`,
          method: 'DELETE'
        })
        if (result.success) {
          Taro.showToast({ title: '已删除好友', icon: 'success' })
          setFriends(prev => prev.filter(f => f.userId !== friendId))
        }
      } catch (error) {
        Taro.showToast({ title: '删除失败', icon: 'none' })
      } finally {
        setActionLoading(false)
      }
    }
  }

  return (
    <View className='friends-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          {/* 搜索区域 */}
          <View className='search-section'>
            <Input
              className='search-input'
              placeholder='搜索用户昵称或ID...'
              value={searchText}
              onInput={(e: any) => {
                const keyword = e.detail.value || ''
                setSearchText(keyword)
                if (searchTimerRef.current) {
                  clearTimeout(searchTimerRef.current)
                }
                searchTimerRef.current = setTimeout(() => {
                  void handleSearch(keyword)
                }, 280)
              }}
            />
          </View>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <View className='search-results'>
              <Text className='results-title'>搜索结果</Text>
              {searchResults.map((user) => (
                <View key={user.id} className='result-item'>
                  <View className='user-info'>
                    <View className='user-avatar'>
                      <Text>{user.nickname?.charAt(0) || 'U'}</Text>
                    </View>
                    <Text className='user-name'>{user.nickname || '未知用户'}</Text>
                  </View>
                  <View 
                    className='add-btn'
                    onClick={() => handleSendRequest(user.id)}
                  >
                    <Text>添加</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tab 切换 */}
          <View className='tab-bar'>
            <View
              className={`tab-item ${activeTab === 0 ? 'active' : ''}`}
              onClick={() => setActiveTab(0)}
            >
              <Text>好友列表</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 1 ? 'active' : ''}`}
              onClick={() => setActiveTab(1)}
            >
              <Text>
                新请求
                {requests.length > 0 && (
                  <Text className='badge'>{requests.length}</Text>
                )}
              </Text>
            </View>
          </View>

          {/* 好友列表 */}
          {activeTab === 0 && (
            <View className='content-panel'>
              {loading ? (
                <View className='loading-wrap'>
                  <LoadingSpinner size={48} />
                </View>
              ) : friends.length === 0 ? (
                <View className='empty-state'>
                  <Text className='empty-text'>还没有好友</Text>
                  <Text className='empty-hint'>去搜索添加一些健身伙伴吧！</Text>
                </View>
              ) : (
                <View className='friends-list'>
                  {friends.map((friend) => (
                    <View key={friend.userId} className='friend-item'>
                      <View
                        className='user-info user-info-tappable'
                        hoverClass='user-info-hover'
                        onClick={() => Taro.navigateTo({ url: `/me/user/index?userId=${friend.userId}` })}
                      >
                        <View className='user-avatar'>
                          <Text>{friend.nickname?.charAt(0) || 'F'}</Text>
                        </View>
                        <Text className='user-name'>{friend.nickname || '未知好友'}</Text>
                      </View>
                      <View 
                        className='remove-btn'
                        onClick={(e: any) => {
                          e.stopPropagation?.()
                          handleRemoveFriend(friend.userId)
                        }}
                      >
                        <Text>删除</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 新请求 */}
          {activeTab === 1 && (
            <View className='content-panel'>
              {loading ? (
                <View className='loading-wrap'>
                  <LoadingSpinner size={48} />
                </View>
              ) : requests.length === 0 ? (
                <View className='empty-state'>
                  <Text className='empty-text'>暂无新请求</Text>
                </View>
              ) : (
                <View className='requests-list'>
                  {requests.map((req) => (
                    <View key={req.friendshipId} className='request-item'>
                      <View className='user-info'>
                        <View className='user-avatar'>
                          <Text>{req.nickname?.charAt(0) || 'U'}</Text>
                        </View>
                        <Text className='user-name'>{req.nickname || '未知用户'}</Text>
                      </View>
                      <View className='request-actions'>
                        <View 
                          className='action-btn accept'
                          onClick={() => handleRespond(req.friendshipId, 'accept')}
                        >
                          <Text>接受</Text>
                        </View>
                        <View 
                          className='action-btn reject'
                          onClick={() => handleRespond(req.friendshipId, 'reject')}
                        >
                          <Text>拒绝</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default FriendsPage
