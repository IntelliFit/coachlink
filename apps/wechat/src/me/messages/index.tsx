import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, useDidHide, usePullDownRefresh, useRouter } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import { chatService, type ChatroomItem, CHAT_UNREAD_BADGE_REFRESH_EVENT } from '@/services/chatService'
import { request } from '@/utils/request'
import { openCoachChat } from '@/utils/coachChat'
import { Location, Message } from '@nutui/icons-react-taro'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

interface FriendRequestBrief {
  friendshipId: string
  userId: string
  nickname: string
}

/** 会话列表摘要：只体现「最近一句」— 首行、Markdown 链接转可见文案、压成单行语义 */
function formatLastMessagePreview(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return '暂无消息'
  const flattened = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const firstNonEmpty = flattened
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!firstNonEmpty) return '暂无消息'
  let line = firstNonEmpty.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  line = line.replace(/\s+/g, ' ').trim()
  return line || '暂无消息'
}

function ChatroomRowAvatar({
  room,
  index,
  displayName
}: {
  room: ChatroomItem
  index: number
  displayName: string
}) {
  const [imgBroken, setImgBroken] = useState(false)
  const url = (room.chatUserProfile?.avatar || '').trim()
  const initial = displayName.charAt(0) || 'U'
  const tones = ['tone-peach', 'tone-blue', 'tone-mint']
  const toneClass = tones[index % tones.length]

  if (url && !imgBroken) {
    return (
      <View className='chatroom-avatar chatroom-avatar--image'>
        <Image
          className='chatroom-avatar-img'
          src={url}
          mode='aspectFill'
          onError={() => setImgBroken(true)}
        />
      </View>
    )
  }

  return (
    <View className={`chatroom-avatar ${toneClass}`}>
      <Text className='chatroom-avatar-text'>{initial}</Text>
    </View>
  )
}

function MessagesPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const pendingCoachId = router.params?.coachId ? decodeURIComponent(router.params.coachId) : ''
  const pendingPeerUserId = router.params?.peerUserId ? decodeURIComponent(router.params.peerUserId) : ''
  const pendingCoachName = router.params?.coachName ? decodeURIComponent(router.params.coachName) : ''
  const lastAutoOpenTargetRef = useRef('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingInFlightRef = useRef(false)

  const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([])
  const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [friendRequests, setFriendRequests] = useState<FriendRequestBrief[]>([])

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
        (pendingPeerUserId || pendingCoachId) &&
        pendingPeerUserId !== userId &&
        lastAutoOpenTargetRef.current !== `${pendingPeerUserId}|${pendingCoachId}`
      ) {
        lastAutoOpenTargetRef.current = `${pendingPeerUserId}|${pendingCoachId}`
        const opened = await openCoachChat({
          currentUserId: userId,
          coachId: pendingCoachId,
          coachUserId: pendingPeerUserId,
          coachName: pendingCoachName
        })
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
      Taro.eventCenter.trigger(CHAT_UNREAD_BADGE_REFRESH_EVENT)
    }
  }, [pendingCoachId, pendingCoachName, pendingPeerUserId, sortChatrooms])

  const loadFriendRequests = useCallback(async () => {
    try {
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        setFriendRequests([])
        return
      }
      const res = await request<{ requests: FriendRequestBrief[] }>({
        url: '/api/user/friends/pending',
        method: 'GET'
      })
      if (res.success && res.data?.requests) {
        setFriendRequests(res.data.requests)
      } else {
        setFriendRequests([])
      }
    } catch (e) {
      console.error('[messages] load friend requests:', e)
      setFriendRequests([])
    }
  }, [])

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
    void loadFriendRequests()
    loadConversations()
    startConversationPolling()
  })

  useDidHide(() => {
    stopConversationPolling()
  })

  usePullDownRefresh(() => {
    void loadFriendRequests()
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

  return (
    <View className={`messages-page theme-${effectiveTheme}`}>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-inner'>
          <View
            className='messages-friends-entry'
            onClick={() =>
              Taro.navigateTo({
                url:
                  friendRequests.length > 0
                    ? '/me/friends/index?tab=requests'
                    : '/me/friends/index'
              })
            }
          >
            <View className='messages-friends-left'>
              <Text className='messages-friends-title'>好友</Text>
              {friendRequests.length > 0 && (
                <View className='messages-friends-badge'>
                  <Text className='messages-friends-badge-text'>
                    {friendRequests.length > 99 ? '99+' : friendRequests.length}
                  </Text>
                </View>
              )}
            </View>
            <Text className='messages-friends-hint' numberOfLines={1}>
              {friendRequests.length > 0
                ? `${friendRequests.length} 条好友申请待处理 · ${friendRequests[0]?.nickname || '用户'} 等`
                : '添加好友、查看好友申请与列表'}
            </Text>
            <Text className='messages-friends-arrow'>›</Text>
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
              <LoadingSpinner size={48} />
            </View>
          ) : filteredChatrooms.length === 0 ? (
            <View className='empty-state'>
              <View className='empty-icon-wrap'>
                <Location width={32} height={32} color='#CF6D4E' />
              </View>
              <Text className='empty-text'>暂无会话</Text>
              <Text className='empty-hint'>下拉刷新，或从上方进入好友页添加联系人</Text>
            </View>
          ) : (
            <View className='chatrooms-list'>
              {filteredChatrooms.map((room, index) => (
                <View
                  key={room.id}
                  className='chatroom-item'
                  onClick={() => handleChatroomClick(room)}
                >
                  <ChatroomRowAvatar room={room} index={index} displayName={getChatUserName(room)} />
                  <View className='chatroom-content'>
                    <View className='chatroom-header'>
                      <Text className='chatroom-name'>{getChatUserName(room)}</Text>
                      <Text className='chatroom-time'>{formatTime(room.lastMessageAt ?? undefined)}</Text>
                    </View>
                    <View className='chatroom-footer'>
                      <View className='chatroom-msg-row'>
                        <Message size={14} color='#9CA3AF' />
                        <Text className='chatroom-message' numberOfLines={1}>
                          {formatLastMessagePreview(room.lastMessage)}
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
