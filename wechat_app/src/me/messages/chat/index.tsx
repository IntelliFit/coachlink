import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { authService } from '@/services/authService'
import {
  chatService,
  type MessageItem,
  type VideoItem,
  type VideoReferenceItem,
  CHAT_UNREAD_BADGE_REFRESH_EVENT
} from '@/services/chatService'
import { getChatMessagesCache, mergeServerLatestPage, setChatMessagesCache } from '@/utils/chatMessageCache'
import { API_BASE_URL } from '@/utils/request'
import './index.scss'
import { Image as ImageIcon } from '@nutui/icons-react-taro'
import { LoadingSpinner } from '@/components/LoadingSpinner'

function buildMessagePreview(message: MessageItem): string {
  const text = (message.content || '').trim()
  if (text) return text.length > 120 ? `${text.slice(0, 120)}...` : text
  if (message.messageType === 'image') return '[图片]'
  if (message.messageType === 'video') return '[视频]'
  if (message.messageType === 'voice') return '[语音]'
  if (message.messageType === 'file') return '[文件]'
  if (message.messageType === 'video_reference') return '[视频引用]'
  if (message.mediaUrl) return '[媒体消息]'
  return '[消息]'
}

function normalizeVideoReference(video: VideoItem): VideoReferenceItem {
  return {
    videoId: video.id,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl ?? null,
    actionName: video.actionName,
    description: video.description ?? null,
    tags: video.tags ?? null,
    sourceType: video.sourceType,
    setNumber: video.setNumber,
    weight: video.weight,
    reps: video.reps,
    isProgress: video.isProgress,
    createdAt: video.createdAt,
    dayIndex: video.dayIndex ?? null,
    studentInfo: video.studentInfo
  }
}

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
  const [highlightedMessageId, setHighlightedMessageId] = useState('')
  const [replyTarget, setReplyTarget] = useState<MessageItem | null>(null)
  const [peerUserId, setPeerUserId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<MessageItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [videoSearchText, setVideoSearchText] = useState('')
  const [onlyProgressVideos, setOnlyProgressVideos] = useState(false)
  const [videoItems, setVideoItems] = useState<VideoItem[]>([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  const currentUser = authService.getCurrentUser()
  const myId = currentUser?.id
  const isCoach = !!currentUser?.is_coach
  const didInitialScrollRef = useRef(false)
  const lastRoomIdRef = useRef(roomId)
  const lastAppliedDraftKeyRef = useRef('')
  /** 与 useEffect(roomId) 触发的首拉去重，避免 useDidShow 与 effect 连续打两次接口 */
  const skipNextDidShowFetchRef = useRef(true)

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

  useEffect(() => {
    if (!roomId || !myId) return
    let cancelled = false
    ;(async () => {
      try {
        const room = await chatService.getChatroom({ roomId })
        if (cancelled) return
        const peer = room?.members?.find(id => id !== myId) || ''
        setPeerUserId(peer)
      } catch (e) {
        console.warn('[chat] load room detail failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId, myId])

  // 支持从其他页面带入建议消息草稿，避免“反馈 -> 沟通”丢失上下文
  useEffect(() => {
    if (!roomId || !draftText) return
    const key = `${roomId}::${draftText}`
    if (lastAppliedDraftKeyRef.current === key) return
    lastAppliedDraftKeyRef.current = key
    setInputText(prev => (prev.trim() ? prev : draftText))
  }, [roomId, draftText])

  const loadMessages = useCallback(
    async (beforeId?: string, options?: { skipSpinner?: boolean }) => {
      if (!roomId || !myId) return
      const skipSpinner = Boolean(options?.skipSpinner) && !beforeId
      if (beforeId) {
        setLoadingMore(true)
      } else if (!skipSpinner) {
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
            setMessages(prev => mergeServerLatestPage(prev, data.messages || []))
          }
          setHasMore(data.has_more ?? false)
        }
        if (!beforeId) {
          await chatService.markAsRead(roomId)
          Taro.eventCenter.trigger(CHAT_UNREAD_BADGE_REFRESH_EVENT)
        }
      } catch (e) {
        console.error('loadMessages error', e)
        if (!beforeId && !skipSpinner) Taro.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [roomId, myId]
  )

  useEffect(() => {
    if (!roomId || !myId) return
    skipNextDidShowFetchRef.current = true
    didInitialScrollRef.current = false
    const cached = getChatMessagesCache(myId, roomId)
    if (cached?.messages?.length) {
      setMessages(cached.messages)
      setHasMore(cached.hasMore)
      setLoading(false)
    } else {
      setMessages([])
      setHasMore(false)
      setLoading(true)
    }
    setReplyTarget(null)
    setHighlightedMessageId('')
    setSearchText('')
    setSearchResults([])
    setVideoPickerOpen(false)
    setSelectedVideoIds([])
    void loadMessages(undefined, { skipSpinner: !!(cached?.messages?.length) })
  }, [roomId, myId, loadMessages])

  useDidShow(() => {
    if (!roomId || !myId) {
      if (!myId) Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (skipNextDidShowFetchRef.current) {
      skipNextDidShowFetchRef.current = false
      return
    }
    void loadMessages(undefined, { skipSpinner: true })
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

  /** 消息列表与 hasMore 落盘，供下次进入会话瞬时展示（不写发送中的 temp-*） */
  useEffect(() => {
    if (!roomId || !myId) return
    const persistable = messages.filter(m => !String(m.id).startsWith('temp-'))
    const t = setTimeout(() => {
      setChatMessagesCache(myId, roomId, { messages: persistable, hasMore })
    }, 400)
    return () => clearTimeout(t)
  }, [messages, hasMore, roomId, myId])

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

  const scrollToMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId)
    setScrollIntoViewId('')
    setTimeout(() => setScrollIntoViewId(`msg-${messageId}`), 80)
    setTimeout(() => setHighlightedMessageId(''), 2600)
  }, [])

  const jumpToMessage = useCallback(async (messageId: string) => {
    if (!roomId || !messageId) return
    const loaded = messages.some(m => m.id === messageId)
    if (loaded) {
      scrollToMessage(messageId)
      return
    }
    const data = await chatService.listMessages({
      roomId,
      anchorMessageId: messageId,
      limit: 50
    })
    if (data?.messages?.length) {
      setMessages(data.messages)
      setHasMore(data.has_more ?? false)
      scrollToMessage(messageId)
    } else {
      Taro.showToast({ title: '未找到原消息', icon: 'none' })
    }
  }, [messages, roomId, scrollToMessage])

  const startReply = useCallback((message: MessageItem) => {
    if (String(message.id).startsWith('temp-')) return
    setReplyTarget(message)
  }, [])

  const performSearch = useCallback(async () => {
    const keyword = searchText.trim()
    if (!keyword || !roomId || searchLoading) return
    setSearchLoading(true)
    try {
      const data = await chatService.searchMessages({ roomId, query: keyword, limit: 20 })
      setSearchResults(data?.messages || [])
      if (!data?.messages?.length) {
        Taro.showToast({ title: '未找到相关消息', icon: 'none' })
      }
    } finally {
      setSearchLoading(false)
    }
  }, [roomId, searchLoading, searchText])

  const targetVideoStudentId = isCoach ? peerUserId : myId

  const loadVideos = useCallback(async () => {
    if (!targetVideoStudentId) return
    setVideoLoading(true)
    try {
      const data = await chatService.listStudentVideos({
        studentId: targetVideoStudentId,
        query: videoSearchText.trim() || undefined,
        onlyProgress: onlyProgressVideos,
        page: 1,
        pageSize: 30
      })
      setVideoItems(data?.videos || [])
      if (!data?.videos?.length) {
        Taro.showToast({ title: '暂无可引用视频', icon: 'none' })
      }
    } finally {
      setVideoLoading(false)
    }
  }, [onlyProgressVideos, targetVideoStudentId, videoSearchText])

  useEffect(() => {
    if (!videoPickerOpen) return
    void loadVideos()
  }, [videoPickerOpen, onlyProgressVideos, loadVideos])

  const toggleVideoSelected = useCallback((id: string) => {
    setSelectedVideoIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }, [])

  const sendText = useCallback(async () => {
    const content = inputText.trim()
    if (!content || sending || !roomId) return
    const currentReplyTarget = replyTarget
    setInputText('')
    setReplyTarget(null)
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
      isMine: true,
      contentMetadata: currentReplyTarget
        ? {
            reply_to_message: {
              id: currentReplyTarget.id,
              senderId: currentReplyTarget.chatUserId,
              senderName: currentReplyTarget.chatUserProfile.name || '用户',
              messageType: currentReplyTarget.messageType,
              contentPreview: buildMessagePreview(currentReplyTarget),
              mediaUrl: currentReplyTarget.mediaUrl
            }
          }
        : null
    }
    setMessages(prev => [...prev, optimistic])
    setScrollIntoViewId(`msg-${tempId}`)

    const res = await chatService.sendMessage({
      roomId,
      messageType: 'text',
      content,
      replyToMessageId: currentReplyTarget?.id
    })
    setSending(false)
    if (!res) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      Taro.showToast({ title: '发送失败', icon: 'none' })
      setInputText(content)
      setReplyTarget(currentReplyTarget)
    } else if (res.messageId) {
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, id: res.messageId! } : m))
      )
    }
  }, [inputText, sending, roomId, myId, replyTarget])

  const chooseAndSendImage = useCallback(async () => {
    if (sending || uploadingImage || !roomId || !myId) return
    const currentReplyTarget = replyTarget
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
      setReplyTarget(null)
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
        isMine: true,
        contentMetadata: currentReplyTarget
          ? {
              reply_to_message: {
                id: currentReplyTarget.id,
                senderId: currentReplyTarget.chatUserId,
                senderName: currentReplyTarget.chatUserProfile.name || '用户',
                messageType: currentReplyTarget.messageType,
                contentPreview: buildMessagePreview(currentReplyTarget),
                mediaUrl: currentReplyTarget.mediaUrl
              }
            }
          : null
      }
      setMessages(prev => [...prev, optimistic])
      setScrollIntoViewId(`msg-${tempId}`)

      const sendRes = await chatService.sendMessage({
        roomId,
        messageType: 'image',
        content: '',
        mediaUrl: imageUrl,
        replyToMessageId: currentReplyTarget?.id
      })
      if (!sendRes) {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setReplyTarget(currentReplyTarget)
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
  }, [sending, uploadingImage, roomId, myId, replyTarget])

  const sendVideoReferences = useCallback(async () => {
    if (sending || !roomId || !myId || selectedVideoIds.length === 0) return
    const selectedVideos = videoItems
      .filter(video => selectedVideoIds.includes(video.id))
      .map(normalizeVideoReference)
    if (selectedVideos.length === 0) return

    const currentReplyTarget = replyTarget
    const tempId = `temp-video-${Date.now()}`
    const content =
      selectedVideos.length === 1
        ? `[视频] ${selectedVideos[0].actionName}`
        : `[${selectedVideos.length}个视频]`

    setSending(true)
    setReplyTarget(null)
    setVideoPickerOpen(false)
    setSelectedVideoIds([])

    const optimistic: MessageItem = {
      id: tempId,
      chatUserId: myId,
      chatUserProfile: { name: '我', avatar: null },
      messageType: 'video_reference',
      content,
      mediaUrl: null,
      fileName: null,
      fileSize: null,
      duration: null,
      isRead: false,
      createdAt: new Date().toISOString(),
      isMine: true,
      contentMetadata: {
        ...(currentReplyTarget
          ? {
              reply_to_message: {
                id: currentReplyTarget.id,
                senderId: currentReplyTarget.chatUserId,
                senderName: currentReplyTarget.chatUserProfile.name || '用户',
                messageType: currentReplyTarget.messageType,
                contentPreview: buildMessagePreview(currentReplyTarget),
                mediaUrl: currentReplyTarget.mediaUrl
              }
            }
          : {}),
        video_references: selectedVideos
      }
    }
    setMessages(prev => [...prev, optimistic])
    setScrollIntoViewId(`msg-${tempId}`)

    const res = await chatService.sendMessage({
      roomId,
      messageType: 'video_reference',
      content: '',
      videoReferences: selectedVideos,
      replyToMessageId: currentReplyTarget?.id
    })

    setSending(false)
    if (!res) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setReplyTarget(currentReplyTarget)
      Taro.showToast({ title: '发送失败', icon: 'none' })
    } else if (res.messageId) {
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, id: res.messageId! } : m))
      )
    }
  }, [myId, replyTarget, roomId, selectedVideoIds, sending, videoItems])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const openVideo = (videoUrl: string) => {
    if (!videoUrl) return
    Taro.navigateTo({
      url: `/common/common/video-player?url=${encodeURIComponent(videoUrl)}`
    })
  }

  const renderReplyQuote = (msg: MessageItem) => {
    const reply = msg.contentMetadata?.reply_to_message
    if (!reply) return null
    return (
      <View
        className={`reply-quote ${msg.isMine ? 'mine' : 'other'}`}
        onClick={(e) => {
          e.stopPropagation()
          void jumpToMessage(reply.id)
        }}
      >
        <Text className="reply-quote-name">{reply.senderName || '用户'}</Text>
        <Text className="reply-quote-text" numberOfLines={1}>{reply.contentPreview}</Text>
      </View>
    )
  }

  const renderMetadataBadge = (msg: MessageItem) => {
    if (msg.contentMetadata?.coach_ai_auto_reply) {
      return <Text className="message-meta-badge">教练 AI 自动回复</Text>
    }
    if (msg.contentMetadata?.broadcast) {
      return <Text className="message-meta-badge">群发通知</Text>
    }
    return null
  }

  const renderVideoReferences = (msg: MessageItem) => {
    const videos = msg.contentMetadata?.video_references || []
    if (!videos.length) {
      return <Text>{msg.content || '[视频引用]'}</Text>
    }
    return (
      <View className="video-ref-list">
        {videos.map(video => (
          <View
            key={video.videoId}
            className="video-ref-card"
            onClick={(e) => {
              e.stopPropagation()
              openVideo(video.videoUrl)
            }}
          >
            {video.thumbnailUrl ? (
              <Image className="video-ref-cover" src={video.thumbnailUrl} mode="aspectFill" />
            ) : (
              <View className="video-ref-cover video-ref-cover--empty">
                <Text className="video-ref-play">▶</Text>
              </View>
            )}
            <View className="video-ref-info">
              <Text className="video-ref-title" numberOfLines={1}>{video.actionName || '训练视频'}</Text>
              <Text className="video-ref-meta" numberOfLines={1}>
                {video.weight || video.reps ? `${video.weight ?? '--'}kg x ${video.reps ?? '--'}` : '个人视频'}
              </Text>
              {video.isProgress && <Text className="video-ref-pr">PR</Text>}
            </View>
          </View>
        ))}
      </View>
    )
  }

  const renderMessageBody = (msg: MessageItem) => {
    if (msg.messageType === 'image' && msg.mediaUrl) {
      return (
        <Image
          src={msg.mediaUrl}
          className="message-img"
          mode="widthFix"
          showMenuByLongpress
        />
      )
    }
    if (msg.messageType === 'video_reference') {
      return renderVideoReferences(msg)
    }
    if (msg.messageType === 'video' && msg.mediaUrl) {
      return (
        <View className="file-message-card" onClick={() => openVideo(msg.mediaUrl || '')}>
          <Text className="file-message-title">视频消息</Text>
          <Text className="file-message-subtitle" numberOfLines={1}>点击播放</Text>
        </View>
      )
    }
    if (msg.messageType === 'voice' && msg.mediaUrl) {
      return (
        <View className="file-message-card">
          <Text className="file-message-title">语音消息</Text>
          <Text className="file-message-subtitle" numberOfLines={1}>
            {msg.duration ? `${msg.duration}s` : '请在网页端播放'}
          </Text>
        </View>
      )
    }
    if (msg.messageType === 'file') {
      return (
        <View className="file-message-card">
          <Text className="file-message-title">{msg.fileName || '文件'}</Text>
          <Text className="file-message-subtitle" numberOfLines={1}>请在网页端下载查看</Text>
        </View>
      )
    }
    return <Text>{msg.content || ''}</Text>
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
      <View className="chat-search-bar">
        <Input
          className="chat-search-input"
          placeholder="搜索聊天记录"
          value={searchText}
          onInput={e => setSearchText((e as any).detail.value)}
          confirmType="search"
          onConfirm={performSearch}
        />
        <View className="chat-search-btn" onClick={performSearch}>
          <Text>{searchLoading ? '搜索中' : '搜索'}</Text>
        </View>
        {(searchText || searchResults.length > 0) && (
          <View
            className="chat-search-clear"
            onClick={() => {
              setSearchText('')
              setSearchResults([])
            }}
          >
            <Text>清除</Text>
          </View>
        )}
      </View>

      {searchResults.length > 0 && (
        <View className="chat-search-results">
          {searchResults.slice(0, 5).map(result => (
            <View
              key={result.id}
              className="chat-search-result"
              onClick={() => {
                setSearchResults([])
                void jumpToMessage(result.id)
              }}
            >
              <Text className="chat-search-result-title" numberOfLines={1}>
                {result.chatUserProfile.name || '用户'} · {formatTime(result.createdAt)}
              </Text>
              <Text className="chat-search-result-text" numberOfLines={1}>
                {buildMessagePreview(result)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        className="chat-messages"
        scrollY
        enableFlex
        scrollIntoView={scrollIntoViewId}
        scrollWithAnimation
        onScrollToUpper={loadMore}
        lowerThreshold={100}
      >
        {loading ? (
          <View className="loading-wrap">
            <LoadingSpinner size={48} />
          </View>
        ) : (
          <>
            {hasMore && messages.length > 0 && (
              <View className="load-more" onClick={loadMore}>
                {loadingMore ? <LoadingSpinner size={32} /> : <Text>下拉加载更多</Text>}
              </View>
            )}
            {messages.map(msg => (
              <View
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`message-row ${msg.isMine ? 'mine' : ''} ${highlightedMessageId === msg.id ? 'highlighted' : ''}`}
              >
                <View
                  className={`message-bubble ${msg.isMine ? 'mine' : 'other'}`}
                  onLongPress={() => startReply(msg)}
                >
                  {renderMetadataBadge(msg)}
                  {renderReplyQuote(msg)}
                  {renderMessageBody(msg)}
                  <Text className="message-time">{formatTime(msg.createdAt)}</Text>
                  <Text className="message-reply-action" onClick={() => startReply(msg)}>回复</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {videoPickerOpen && (
        <View className="video-picker-panel">
          <View className="video-picker-header">
            <Text className="video-picker-title">引用训练视频</Text>
            <Text className="video-picker-close" onClick={() => setVideoPickerOpen(false)}>关闭</Text>
          </View>
          <View className="video-picker-filters">
            <Input
              className="video-picker-input"
              placeholder="搜索动作"
              value={videoSearchText}
              onInput={e => setVideoSearchText((e as any).detail.value)}
              confirmType="search"
              onConfirm={loadVideos}
            />
            <View
              className={`video-picker-filter ${onlyProgressVideos ? 'active' : ''}`}
              onClick={() => setOnlyProgressVideos(v => !v)}
            >
              <Text>只看 PR</Text>
            </View>
            <View className="video-picker-filter" onClick={loadVideos}>
              <Text>刷新</Text>
            </View>
          </View>
          <ScrollView className="video-picker-list" scrollY>
            {videoLoading ? (
              <View className="video-picker-loading"><LoadingSpinner size={32} /></View>
            ) : (
              videoItems.map(video => {
                const selected = selectedVideoIds.includes(video.id)
                return (
                  <View
                    key={video.id}
                    className={`video-picker-item ${selected ? 'selected' : ''}`}
                    onClick={() => toggleVideoSelected(video.id)}
                  >
                    {video.thumbnailUrl ? (
                      <Image className="video-picker-cover" src={video.thumbnailUrl} mode="aspectFill" />
                    ) : (
                      <View className="video-picker-cover video-picker-cover--empty">
                        <Text>▶</Text>
                      </View>
                    )}
                    <View className="video-picker-info">
                      <Text className="video-picker-name" numberOfLines={1}>{video.actionName || '训练视频'}</Text>
                      <Text className="video-picker-meta" numberOfLines={1}>
                        {video.weight || video.reps ? `${video.weight ?? '--'}kg x ${video.reps ?? '--'}` : '个人视频'}
                      </Text>
                    </View>
                    <Text className="video-picker-check">{selected ? '已选' : '选择'}</Text>
                  </View>
                )
              })
            )}
          </ScrollView>
          <View className="video-picker-footer">
            <Text className="video-picker-count">已选 {selectedVideoIds.length} 个</Text>
            <View
              className={`video-picker-send ${selectedVideoIds.length === 0 || sending ? 'disabled' : ''}`}
              onClick={sendVideoReferences}
            >
              <Text>发送引用</Text>
            </View>
          </View>
        </View>
      )}

      {replyTarget && (
        <View className="reply-composer">
          <View className="reply-composer-main">
            <Text className="reply-composer-label">正在回复 {replyTarget.chatUserProfile.name || '用户'}</Text>
            <Text className="reply-composer-text" numberOfLines={1}>{buildMessagePreview(replyTarget)}</Text>
          </View>
          <Text className="reply-composer-cancel" onClick={() => setReplyTarget(null)}>取消</Text>
        </View>
      )}

      <View className="chat-input-bar">
        <View
          className="video-btn"
          onClick={() => {
            setVideoPickerOpen(v => !v)
          }}
        >
          <Text>视频</Text>
        </View>
        <View className="img-btn" onClick={chooseAndSendImage}>
          <ImageIcon size={40} />
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
          <Text className='iconfont icon-send send-btn__icon' />
        </View>
      </View>
    </View>
  )
}

export default ChatPage
