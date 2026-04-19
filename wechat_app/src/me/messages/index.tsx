import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow, useDidHide, usePullDownRefresh, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { chatService, type ChatroomItem } from '@/services/chatService'
import { Calendar, Location, Message, Power, Search, Star } from '@nutui/icons-react-taro'
import './index.scss'

function MessagesPage() {
  const router = useRouter()
  const pendingCoachId = router.params?.coachId ? decodeURIComponent(router.params.coachId) : ''
  const pendingCoachName = router.params?.coachName ? decodeURIComponent(router.params.coachName) : ''
  const lastAutoOpenCoachIdRef = useRef('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingInFlightRef = useRef(false)

  const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([])
  const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  const getChatUserName = useCallback((room: ChatroomItem) => {
    return room.chatUserProfile?.name || '未知用户'
  }, [])

  const sortChatrooms = useCallback((rooms: ChatroomItem[]) => {
    return [...rooms].sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return timeB - timeA
    })
  }, [])

  const openChatWithCoach = useCallback(async (userId: string, coachId: string, coachName?: string) => {
    try {
      const room = await chatService.getChatroom({ members: [userId, coachId] })
      if (!room?.id) {
        Taro.showToast({ title: '创建会话失败，请稍后重试', icon: 'none' })
        return false
      }
      const name = coachName || '教练'
      await Taro.navigateTo({
        url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(name)}`
      })
      return true
    } catch (error) {
      console.error('打开会话失败:', error)
      Taro.showToast({ title: '打开会话失败，请稍后重试', icon: 'none' })
      return false
    }
  }, [])

  const loadConversations = useCallback(async (options?: { silent?: boolean; skipAutoOpen?: boolean }) => {
    const silent = Boolean(options?.silent)
    const skipAutoOpen = Boolean(options?.skipAutoOpen)
    try {
      if (!silent) setLoading(true)
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        if (!silent) {
          Taro.showToast({ title: '请先登录', icon: 'none' })
        }
        return
      }

      if (
        !skipAutoOpen &&
        pendingCoachId &&
        pendingCoachId !== userId &&
        lastAutoOpenCoachIdRef.current !== pendingCoachId
      ) {
        lastAutoOpenCoachIdRef.current = pendingCoachId
        const opened = await openChatWithCoach(userId, pendingCoachId, pendingCoachName)
        if (opened) return
      }

      const data = await chatService.listChatrooms({ page: 1, limit: 50 })
      if (data?.chatRooms) {
        setChatrooms(sortChatrooms(data.chatRooms))
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
      if (!silent) {
        Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [openChatWithCoach, pendingCoachId, pendingCoachName, sortChatrooms])

  const stopConversationPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startConversationPolling = useCallback(() => {
    stopConversationPolling()
    pollTimerRef.current = setInterval(() => {
      if (pollingInFlightRef.current) return
      pollingInFlightRef.current = true
      loadConversations({ silent: true, skipAutoOpen: true }).finally(() => {
        pollingInFlightRef.current = false
      })
    }, 12000)
  }, [loadConversations, stopConversationPolling])

  useDidShow(() => {
    loadConversations()
    startConversationPolling()
  })

  useDidHide(() => {
    stopConversationPolling()
  })

  usePullDownRefresh(() => {
    loadConversations().finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    return () => stopConversationPolling()
  }, [stopConversationPolling])

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredChatrooms(chatrooms)
      return
    }

    const keyword = searchText.toLowerCase()
    const filtered = chatrooms.filter((room) => {
      const peerName = getChatUserName(room).toLowerCase()
      const message = (room.lastMessage || '').toLowerCase()
      return peerName.includes(keyword) || message.includes(keyword)
    })
    setFilteredChatrooms(filtered)
  }, [searchText, chatrooms, getChatUserName])

  const handleNav = (url: string) => {
    const normalized = url.startsWith('/') ? url : `/${url}`
    Taro.navigateTo({ url: normalized }).catch(() => {
      Taro.reLaunch({ url: normalized }).catch(() => {})
    })
  }

  const handleChatroomClick = (room: ChatroomItem) => {
    const name = getChatUserName(room)
    Taro.navigateTo({
      url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(name)}`
    })
  }

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  const avatarToneClass = (index: number) => {
    const tones = ['tone-peach', 'tone-blue', 'tone-mint']
    return tones[index % tones.length]
  }

  return (
    <View className='messages-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-inner'>
          <View className='messages-shortcuts'>
            <View className='msg-shortcut' onClick={() => handleNav('/training/today-training')}>
              <View className='msg-shortcut-icon peach'>
                <Power width={22} height={22} color='#010101' />
              </View>
              <Text className='msg-shortcut-label'>训练</Text>
            </View>
            <View className='msg-shortcut' onClick={() => handleNav('/discovery/index')}>
              <View className='msg-shortcut-icon blue'>
                <Search width={22} height={22} color='#010101' />
              </View>
              <Text className='msg-shortcut-label'>发现</Text>
            </View>
            <View className='msg-shortcut' onClick={() => handleNav('/discovery/ranking')}>
              <View className='msg-shortcut-icon yellow'>
                <Star width={22} height={22} color='#010101' />
              </View>
              <Text className='msg-shortcut-label'>排行</Text>
            </View>
            <View className='msg-shortcut' onClick={() => handleNav('/me/plan-lib/index')}>
              <View className='msg-shortcut-icon mint'>
                <Calendar width={22} height={22} color='#010101' />
              </View>
              <Text className='msg-shortcut-label'>计划库</Text>
            </View>
          </View>

          <View className='search-section'>
            <Text className='iconfont icon-search search-section-icon' />
            <Input
              className='search-input'
              placeholder='搜索联系人或聊天内容'
              value={searchText}
              onInput={(e: any) => setSearchText(e.detail.value)}
            />
          </View>

          <View className='list-section-header'>
            <Text className='list-section-title'>会话</Text>
            <View className='list-section-tag'>
              <Message size={14} color='#CF6D4E' />
              <Text className='list-section-tag-text'>消息列表</Text>
            </View>
          </View>

          {loading ? (
            <View className='loading-wrap'>
              <View className='loading-dot' />
              <Text className='loading-text'>加载中…</Text>
            </View>
          ) : filteredChatrooms.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon-wrap'>
                <Location width={32} height={32} color='#CF6D4E' />
              </View>
              <Text className='empty-text'>暂无会话</Text>
              <Text className='empty-hint'>下拉刷新，或通过上方入口开始训练与发现</Text>
            </View>
          ) : (
            <View className='chatrooms-list'>
              {filteredChatrooms.map((room, index) => (
                <View
                  key={room.id}
                  className='chatroom-item'
                  onClick={() => handleChatroomClick(room)}
                >
                  <View className={`chatroom-avatar ${avatarToneClass(index)}`}>
                    <Text className='chatroom-avatar-text'>{getChatUserName(room).charAt(0) || 'U'}</Text>
                  </View>
                  <View className='chatroom-content'>
                    <View className='chatroom-header'>
                      <Text className='chatroom-name'>{getChatUserName(room)}</Text>
                      <Text className='chatroom-time'>{formatTime(room.lastMessageAt ?? undefined)}</Text>
                    </View>
                    <View className='chatroom-footer'>
                      <View className='chatroom-msg-row'>
                        <Message size={14} color='#9CA3AF' />
                        <Text className='chatroom-message' numberOfLines={1}>
                          {room.lastMessage ?? '暂无消息'}
                        </Text>
                      </View>
                      {room.unreadCount > 0 && (
                        <View className='unread-badge'>
                          <Text>{room.unreadCount > 99 ? '99+' : room.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
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

export default MessagesPage
