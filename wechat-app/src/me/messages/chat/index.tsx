import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { authService } from '@/services/authService'
import { chatService, type MessageItem } from '@/services/chatService'
import { API_BASE_URL } from '@/utils/request'
import './index.scss'
import { Image as ImageIcon } from '@nutui/icons-react-taro'

function ChatPage() {
  const router = useRouter()
  const roomId = router.params?.roomId || ''
  const peerName = router.params?.peerName ? decodeURIComponent(router.params.peerName) : '聊天'
  const draftText = router.params?.draft ? decodeURIComponent(router.params.draft) : ''

  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [scrollIntoViewId, setScrollIntoViewId] = useState('')
  const myId = authService.getCurrentUser()?.id
  const didInitialScrollRef = useRef(false)
  const lastRoomIdRef = useRef(roomId)
  const lastAppliedDraftKeyRef = useRef('')

  if (lastRoomIdRef.current !== roomId) {
    lastRoomIdRef.current = roomId
    didInitialScrollRef.current = false
  }

  // 首次加载完成后滚到底部（列表渲染需要时间，延迟执行）
  useEffect(() => {
    if (loading || messages.length === 0) return
    if (didInitialScrollRef.current) return
    didInitialScrollRef.current = true
    const last = messages[messages.length - 1]
    const t = setTimeout(() => setScrollIntoViewId(`msg-${last.id}`), 300)
    return () => clearTimeout(t)
  }, [loading, messages])

  const setNavTitle = useCallback((title: string) => {
    Taro.setNavigationBarTitle({ title: title || '聊天' })
  }, [])

  useEffect(() => {
    if (peerName) setNavTitle(peerName)
  }, [peerName, setNavTitle])

  // 支持从其他页面带入建议消息草稿，避免“反馈 -> 沟通”丢失上下文
  useEffect(() => {
    if (!roomId || !draftText) return
    const key = `${roomId}::${draftText}`
    if (lastAppliedDraftKeyRef.current === key) return
    lastAppliedDraftKeyRef.current = key
    setInputText(prev => (prev.trim() ? prev : draftText))
  }, [roomId, draftText])

  const loadMessages = useCallback(
    async (beforeId?: string) => {
      if (!roomId || !myId) return
      if (beforeId) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      try {
        const data = await chatService.listMessages({
          roomId,
          limit: 50,
          beforeId: beforeId || undefined
        })
        if (data) {
          if (beforeId) {
            setMessages(prev => [...(data.messages || []), ...prev])
          } else {
            setMessages(data.messages || [])
          }
          setHasMore(data.has_more ?? false)
        }
        if (!beforeId) {
          await chatService.markAsRead(roomId)
        }
      } catch (e) {
        console.error('loadMessages error', e)
        if (!beforeId) Taro.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [roomId, myId]
  )

  useDidShow(() => {
    if (roomId && myId) {
      loadMessages()
    } else if (!myId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
    }
  })

  // 轮询拉取新消息（小程序无 SSE，用定时刷新模拟网页端实时）
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollToIdAfterPollRef = useRef<string | null>(null)
  useEffect(() => {
    if (!roomId || !myId || loading) return
    const POLL_MS = 3000
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await chatService.listMessages({ roomId, limit: 50 })
        if (!data?.messages?.length) return
        setMessages(prev => {
          const prevIds = new Set(prev.map(m => m.id))
          const hasNewFromOther = data.messages.some(m => !prevIds.has(m.id) && !m.isMine)
          const optimistic = prev.filter(m => String(m.id).startsWith('temp-'))
          const serverOldest = data.messages[0]
          const olderThanServer = serverOldest
            ? prev.filter(
                m => !String(m.id).startsWith('temp-') && m.createdAt < serverOldest.createdAt
              )
            : []
          const merged = [...olderThanServer, ...data.messages, ...optimistic]
          const last = merged[merged.length - 1]
          if (hasNewFromOther && last) scrollToIdAfterPollRef.current = last.id
          return merged
        })
      } catch {
        // 静默失败，下次再轮询
      }
    }, POLL_MS)
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [roomId, myId, loading])

  // 轮询合并后若有对方新消息，先清空再设 scrollIntoView 以强制触发滚动
  useEffect(() => {
    const targetId = scrollToIdAfterPollRef.current
    if (!targetId) return
    scrollToIdAfterPollRef.current = null
    setScrollIntoViewId('')
    const t = setTimeout(() => setScrollIntoViewId(`msg-${targetId}`), 350)
    return () => clearTimeout(t)
  }, [messages])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) return
    const first = messages[0]
    if (first) loadMessages(first.id)
  }, [loadingMore, hasMore, messages, loadMessages])

  const sendText = useCallback(async () => {
    const content = inputText.trim()
    if (!content || sending || !roomId) return
    setInputText('')
    setSending(true)
    const tempId = `temp-${Date.now()}`
    const optimistic: MessageItem = {
      id: tempId,
      chatUserId: myId!,
      chatUserProfile: { name: '我', avatar: null },
      messageType: 'text',
      content,
      mediaUrl: null,
      fileName: null,
      fileSize: null,
      duration: null,
      isRead: false,
      createdAt: new Date().toISOString(),
      isMine: true
    }
    setMessages(prev => [...prev, optimistic])
    setScrollIntoViewId(`msg-${tempId}`)

    const res = await chatService.sendMessage({
      roomId,
      messageType: 'text',
      content
    })
    setSending(false)
    if (!res) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      Taro.showToast({ title: '发送失败', icon: 'none' })
      setInputText(content)
    } else if (res.messageId) {
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, id: res.messageId! } : m))
      )
    }
  }, [inputText, sending, roomId, myId])

  const chooseAndSendImage = useCallback(async () => {
    if (sending || uploadingImage || !roomId || !myId) return
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const path = chooseRes.tempFilePaths[0]
      if (!path) return
      setUploadingImage(true)
      const token = Taro.getStorageSync('token') || ''
      const uploadRes = await Taro.uploadFile({
        url: `${API_BASE_URL}/api/upload/chat-image`,
        filePath: path,
        name: 'file',
        header: { Authorization: token ? `Bearer ${token}` : '' }
      })
      if (uploadRes.statusCode !== 200) {
        const data = JSON.parse(uploadRes.data || '{}')
        Taro.showToast({ title: data?.message || '上传失败', icon: 'none' })
        setUploadingImage(false)
        return
      }
      const data = JSON.parse(uploadRes.data || '{}')
      const imageUrl = data?.data?.url
      if (!imageUrl) {
        Taro.showToast({ title: '上传失败', icon: 'none' })
        setUploadingImage(false)
        return
      }
      const tempId = `temp-img-${Date.now()}`
      const optimistic: MessageItem = {
        id: tempId,
        chatUserId: myId,
        chatUserProfile: { name: '我', avatar: null },
        messageType: 'image',
        content: '',
        mediaUrl: imageUrl,
        fileName: null,
        fileSize: null,
        duration: null,
        isRead: false,
        createdAt: new Date().toISOString(),
        isMine: true
      }
      setMessages(prev => [...prev, optimistic])
      setScrollIntoViewId(`msg-${tempId}`)

      const sendRes = await chatService.sendMessage({
        roomId,
        messageType: 'image',
        content: '',
        mediaUrl: imageUrl
      })
      if (!sendRes) {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        Taro.showToast({ title: '发送失败', icon: 'none' })
      } else if (sendRes.messageId) {
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...m, id: sendRes.messageId! } : m))
        )
      }
    } catch (e) {
      console.error('chooseAndSendImage error', e)
      Taro.showToast({ title: '选择图片失败', icon: 'none' })
    } finally {
      setUploadingImage(false)
    }
  }, [sending, uploadingImage, roomId, myId])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  if (!roomId) {
    return (
      <View className="chat-page">
        <View className="loading-wrap">
          <Text>缺少会话信息</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="chat-page">
      <ScrollView
        className="chat-messages"
        scrollY
        scrollIntoView={scrollIntoViewId}
        scrollWithAnimation
        onScrollToUpper={loadMore}
        lowerThreshold={100}
      >
        {loading ? (
          <View className="loading-wrap">
            <Text>加载中...</Text>
          </View>
        ) : (
          <>
            {hasMore && messages.length > 0 && (
              <View className="load-more" onClick={loadMore}>
                {loadingMore ? <Text>加载更多...</Text> : <Text>下拉加载更多</Text>}
              </View>
            )}
            {messages.map(msg => (
              <View
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`message-row ${msg.isMine ? 'mine' : ''}`}
              >
                <View className={`message-bubble ${msg.isMine ? 'mine' : 'other'}`}>
                  {msg.messageType === 'image' && msg.mediaUrl ? (
                    <Image
                      src={msg.mediaUrl}
                      className="message-img"
                      mode="widthFix"
                      showMenuByLongpress
                    />
                  ) : (
                    <Text>{msg.content || ''}</Text>
                  )}
                  <Text className="message-time">{formatTime(msg.createdAt)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View className="chat-input-bar">
        <View className="img-btn" onClick={chooseAndSendImage}>
          <ImageIcon />
        </View>
        <Input
          className="input-wrap"
          placeholder="输入消息..."
          value={inputText}
          onInput={e => setInputText((e as any).detail.value)}
          confirmType="send"
          onConfirm={sendText}
          adjustPosition
          disabled={sending || uploadingImage}
        />
        <View
          className={`send-btn ${(!inputText.trim() && !uploadingImage) || sending ? 'disabled' : ''}`}
          onClick={sendText}
        >
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}

export default ChatPage
