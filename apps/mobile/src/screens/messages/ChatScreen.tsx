import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { resolveCoachLinkAppRole } from '@coachlink/core'
import { apiClient, fetchWithTimeout, getStoredToken } from '../../api'
import { API_BASE_URL } from '../../config'
import { openExternalUrl } from '../../externalLinks'
import { IconFont } from '../../components/IconFont'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import { VideoPlayerModal, type VideoPlayerTarget } from '../../components/VideoPlayerModal'
import { useAuth } from '../../providers/AuthProvider'
import { useMessageCenter } from '../../providers/MessageCenterProvider'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { LoadingState, errorMessage, styles as shellStyles, type RootNav } from '../me/MeShared'
import { getChatMessagesCache, mergeOlderMessages, mergeServerLatestPage, setChatMessagesCache } from './chatMessageCache'
import { buildMessagePreview, buildReplyQuote, latestStableMessageId, videoReferenceSummary, type ChatMessage, type VideoReference } from './chatMessageModel'
import { ChatMessageBubble } from './ChatMessageBubble'
import { ChatVideoPicker } from './ChatVideoPicker'

type ListMessagesResponse = { messages?: ChatMessage[]; has_more?: boolean }
type SendResponse = { messageId?: string; createdAt?: string }
type ChatroomResponse = { chatroom?: { id: string; members?: string[]; chatUserProfile?: { name?: string | null } | null } | null }

const POLL_INTERVAL_MS = 3_000
const NEAR_BOTTOM_PX = 120

function tempId(prefix = 'temp') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>()
  const navigation = useNavigation<RootNav>()
  const { user } = useAuth()
  const { refreshUnreadCount } = useMessageCenter()
  const roomId = route.params?.roomId || ''
  const myId = user?.id ? String(user.id) : ''
  const isCoachMode = resolveCoachLinkAppRole(user) === 'coach'

  const [title, setTitle] = useState(route.params?.peerName || '聊天')
  const [peerUserId, setPeerUserId] = useState('')
  const [input, setInput] = useState(route.params?.draft || '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cacheReadyRoomId, setCacheReadyRoomId] = useState('')
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
  const [highlightedId, setHighlightedId] = useState('')
  const [anchored, setAnchored] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoTarget, setVideoTarget] = useState<VideoPlayerTarget | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const positionsRef = useRef(new Map<string, number>())
  const nearBottomRef = useRef(true)
  const loadingRef = useRef(false)
  const lastMarkedIdRef = useRef('')
  const anchoredRef = useRef(false)
  const pendingScrollIdRef = useRef('')

  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    anchoredRef.current = anchored
  }, [anchored])

  // 按 roomId 取会话详情：标题用对方昵称、拿到对方 userId，旧会话 id 自动换成规范会话。
  useEffect(() => {
    if (!roomId || !myId) return
    let cancelled = false
    apiClient.request<ChatroomResponse>('/api/chat/get-chatroom', { method: 'POST', body: { roomId }, timeoutMs: 10_000 })
      .then((data) => {
        const room = data.chatroom
        if (cancelled || !room) return
        const name = room.chatUserProfile?.name || route.params?.peerName || '聊天'
        if (room.id && room.id !== roomId) {
          navigation.replace('Chat', { roomId: room.id, peerName: name, draft: route.params?.draft })
          return
        }
        setTitle(name)
        setPeerUserId((room.members || []).find((id) => id !== myId) || '')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [myId, navigation, roomId, route.params?.draft, route.params?.peerName])

  const markReadIfNeeded = useCallback(async (latestId: string) => {
    if (!roomId || !latestId || latestId === lastMarkedIdRef.current) return
    lastMarkedIdRef.current = latestId
    await apiClient.request('/api/chat/mark-as-read', { method: 'POST', body: { roomId }, timeoutMs: 8_000 }).catch(() => {
      lastMarkedIdRef.current = ''
    })
    void refreshUnreadCount()
  }, [refreshUnreadCount, roomId])

  const loadLatest = useCallback(async (silent: boolean) => {
    if (!roomId) {
      setLoading(false)
      setError('缺少会话 ID')
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    if (!silent) setLoading(true)
    try {
      const data = await apiClient.request<ListMessagesResponse>('/api/chat/list-messages', { method: 'POST', body: { roomId, limit: 50 }, timeoutMs: 12_000 })
      const page = data.messages || []
      // 跳转到历史消息时暂停合并最新页，避免列表中间出现断档；「回到最新」后恢复。
      if (!anchoredRef.current) {
        setMessages((current) => mergeServerLatestPage(current, page))
        setHasMore(Boolean(data.has_more))
      }
      setError('')
      void markReadIfNeeded(latestStableMessageId(page))
    } catch (loadError) {
      setError(errorMessage(loadError, '消息加载失败'))
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [markReadIfNeeded, roomId])

  useFocusEffect(useCallback(() => {
    let active = true
    setCacheReadyRoomId('')
    void (async () => {
      const cached = myId && roomId ? await getChatMessagesCache(myId, roomId) : null
      if (!active) return
      if (cached) {
        setMessages(cached.messages)
        setHasMore(cached.hasMore)
        setLoading(false)
      }
      setCacheReadyRoomId(roomId)
      await loadLatest(Boolean(cached))
    })()
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void loadLatest(true)
    }, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [loadLatest, myId, roomId]))

  useEffect(() => {
    // 空列表不落缓存：「回到最新」会先清空列表，离线重载失败时不能抹掉本地 60 天记录。
    if (!myId || !roomId || cacheReadyRoomId !== roomId || anchored) return
    if (!messages.some((item) => !String(item.id).startsWith('temp-'))) return
    void setChatMessagesCache(myId, roomId, { messages, hasMore })
  }, [anchored, cacheReadyRoomId, hasMore, messages, myId, roomId])

  const scrollToMessage = useCallback((messageId: string) => {
    const y = positionsRef.current.get(messageId)
    if (y === undefined) {
      pendingScrollIdRef.current = messageId
      return
    }
    pendingScrollIdRef.current = ''
    nearBottomRef.current = false
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 96), animated: true })
    setHighlightedId(messageId)
    setTimeout(() => setHighlightedId((current) => (current === messageId ? '' : current)), 2600)
  }, [])

  const jumpToMessage = useCallback(async (messageId: string) => {
    if (!roomId || !messageId) return
    if (messagesRef.current.some((item) => item.id === messageId)) {
      scrollToMessage(messageId)
      return
    }
    try {
      const data = await apiClient.request<ListMessagesResponse>('/api/chat/list-messages', { method: 'POST', body: { roomId, anchorMessageId: messageId, limit: 50 }, timeoutMs: 12_000 })
      if (!data.messages?.length) {
        Alert.alert('未找到原消息', '这条消息可能已超过可查看范围。')
        return
      }
      positionsRef.current.clear()
      // 先同步置位：轮询可能在下一次渲染前返回，不能把最新页合并进历史定位列表。
      anchoredRef.current = true
      setAnchored(true)
      setMessages(data.messages)
      setHasMore(Boolean(data.has_more))
      pendingScrollIdRef.current = messageId
    } catch (jumpError) {
      Alert.alert('定位失败', errorMessage(jumpError))
    }
  }, [roomId, scrollToMessage])

  const onJumpToMessage = useCallback((messageId: string) => {
    void jumpToMessage(messageId)
  }, [jumpToMessage])

  const onOpenFile = useCallback((url: string) => {
    void openExternalUrl(url, { errorMessage: '暂时无法打开该文件。' })
  }, [])

  const backToLatest = useCallback(async () => {
    positionsRef.current.clear()
    anchoredRef.current = false
    setAnchored(false)
    nearBottomRef.current = true
    // 先回到本地缓存的最新消息（离线也能看），再向云端拉最新一页。
    const cached = myId && roomId ? await getChatMessagesCache(myId, roomId).catch(() => null) : null
    setMessages(cached?.messages || [])
    setHasMore(Boolean(cached?.hasMore))
    void loadLatest(Boolean(cached))
  }, [loadLatest, myId, roomId])

  const loadOlder = useCallback(async () => {
    const firstStable = messages.find((item) => !String(item.id).startsWith('temp-'))
    if (!roomId || loadingMore || !hasMore || !firstStable) return
    setLoadingMore(true)
    try {
      const data = await apiClient.request<ListMessagesResponse>('/api/chat/list-messages', { method: 'POST', body: { roomId, limit: 50, beforeId: firstStable.id }, timeoutMs: 12_000 })
      nearBottomRef.current = false
      setMessages((current) => mergeOlderMessages(current, data.messages || []))
      setHasMore(Boolean(data.has_more))
    } catch (loadError) {
      Alert.alert('加载失败', errorMessage(loadError))
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, messages, roomId])

  const appendOptimistic = (message: ChatMessage) => {
    nearBottomRef.current = true
    if (anchoredRef.current) {
      // 停在历史消息时发送：回到最新一页再追加，避免列表中间断档。
      anchoredRef.current = false
      setAnchored(false)
      positionsRef.current.clear()
      setMessages([message])
      return
    }
    setMessages((current) => [...current, message])
  }

  const settleOptimistic = (id: string, sent: SendResponse, patch: Partial<ChatMessage> = {}) => {
    setMessages((current) => current.map((item) => (item.id === id ? {
      ...item,
      ...patch,
      id: sent.messageId || item.id,
      createdAt: sent.createdAt || item.createdAt,
      pending: false,
      failed: false,
    } : item)))
  }

  const failOptimistic = (id: string) => {
    setMessages((current) => current.map((item) => (item.id === id ? { ...item, pending: false, failed: true } : item)))
  }

  const replyMetadata = (target: ChatMessage | null) => (target ? { reply_to_message: buildReplyQuote(target) } : null)

  async function sendText(content: string, target: ChatMessage | null, retryId?: string) {
    if (!roomId || !content) return
    const id = retryId || tempId()
    if (retryId) {
      setMessages((current) => current.map((item) => (item.id === retryId ? { ...item, pending: true, failed: false } : item)))
    } else {
      appendOptimistic({ id, messageType: 'text', content, createdAt: new Date().toISOString(), isMine: true, pending: true, contentMetadata: replyMetadata(target) })
    }
    setSending(true)
    try {
      const sent = await apiClient.request<SendResponse>('/api/chat/send-message', {
        method: 'POST',
        body: { roomId, messageType: 'text', content, replyToMessageId: target?.id },
        timeoutMs: 12_000,
      })
      settleOptimistic(id, sent)
      void loadLatest(true)
    } catch (sendError) {
      failOptimistic(id)
      Alert.alert('发送失败', errorMessage(sendError))
    } finally {
      setSending(false)
    }
  }

  function submitText() {
    const content = input.trim()
    if (!content || sending) return
    const target = replyTarget
    setInput('')
    setReplyTarget(null)
    void sendText(content, target)
  }

  async function sendImage() {
    if (!roomId || uploadingImage) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请允许 CoachLink 访问相册后再发送图片。')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset?.uri) return

    const target = replyTarget
    setReplyTarget(null)
    const id = tempId()
    appendOptimistic({ id, messageType: 'image', content: '', mediaUrl: asset.uri, createdAt: new Date().toISOString(), isMine: true, pending: true, contentMetadata: replyMetadata(target) })
    setUploadingImage(true)
    try {
      const token = await getStoredToken()
      const form = new FormData()
      form.append('file', { uri: asset.uri, name: asset.fileName || `chat-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' } as any)
      const uploadResponse = await fetchWithTimeout(`${API_BASE_URL}/api/upload/chat-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })
      const uploadJson = await uploadResponse.json().catch(() => null)
      const url = uploadJson?.data?.url
      if (!uploadResponse.ok || !uploadJson?.success || !url) throw new Error(uploadJson?.message || '图片上传失败')
      const sent = await apiClient.request<SendResponse>('/api/chat/send-message', {
        method: 'POST',
        body: { roomId, messageType: 'image', mediaUrl: url, content: '', replyToMessageId: target?.id },
        timeoutMs: 12_000,
      })
      settleOptimistic(id, sent, { mediaUrl: url })
      void loadLatest(true)
    } catch (imageError) {
      failOptimistic(id)
      Alert.alert('图片发送失败', errorMessage(imageError))
    } finally {
      setUploadingImage(false)
    }
  }

  async function sendVideoReferences(videos: VideoReference[]) {
    setVideoPickerOpen(false)
    if (!roomId || videos.length === 0) return
    const target = replyTarget
    setReplyTarget(null)
    const id = tempId('temp-video')
    appendOptimistic({
      id,
      messageType: 'video_reference',
      content: videoReferenceSummary(videos),
      createdAt: new Date().toISOString(),
      isMine: true,
      pending: true,
      contentMetadata: { ...(replyMetadata(target) || {}), video_references: videos },
    })
    setSending(true)
    try {
      const sent = await apiClient.request<SendResponse>('/api/chat/send-message', {
        method: 'POST',
        // 服务端只信任 videoId，会按权限重新组装视频信息。
        body: { roomId, messageType: 'video_reference', content: '', videoReferences: videos.map((video) => ({ videoId: video.videoId })), replyToMessageId: target?.id },
        timeoutMs: 15_000,
      })
      settleOptimistic(id, sent)
      void loadLatest(true)
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== id))
      setReplyTarget(target)
      Alert.alert('发送失败', errorMessage(sendError))
    } finally {
      setSending(false)
    }
  }

  const sendTextRef = useRef(sendText)
  sendTextRef.current = sendText

  const onMessageLongPress = useCallback((message: ChatMessage) => {
    const stable = !String(message.id).startsWith('temp-')
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = []
    if (message.failed && message.messageType === 'text' && message.content) {
      buttons.push({ text: '重新发送', onPress: () => void sendTextRef.current(String(message.content), null, message.id) })
    }
    if (stable) buttons.push({ text: '回复', onPress: () => setReplyTarget(message) })
    if (message.content && message.messageType === 'text') {
      buttons.push({ text: '复制', onPress: () => void Clipboard.setStringAsync(String(message.content)) })
    }
    if (buttons.length === 0) return
    buttons.push({ text: '取消', style: 'cancel' })
    Alert.alert('消息操作', buildMessagePreview(message), buttons)
  }, [])

  async function runSearch() {
    const keyword = searchText.trim()
    if (!keyword || !roomId || searching) return
    setSearching(true)
    try {
      const data = await apiClient.request<{ messages?: ChatMessage[] }>('/api/chat/search-messages', { method: 'POST', body: { roomId, query: keyword, limit: 20 }, timeoutMs: 12_000 })
      setSearchResults(data.messages || [])
    } catch (searchError) {
      Alert.alert('搜索失败', errorMessage(searchError))
    } finally {
      setSearching(false)
    }
  }

  const openSearchResult = (messageId: string) => {
    setSearchOpen(false)
    setSearchResults(null)
    void jumpToMessage(messageId)
  }

  const onBubbleLayout = (id: string) => (event: LayoutChangeEvent) => {
    positionsRef.current.set(id, event.nativeEvent.layout.y)
    if (pendingScrollIdRef.current === id) {
      setTimeout(() => scrollToMessage(id), 60)
    }
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM_PX
  }

  const videoStudentId = isCoachMode ? peerUserId : myId

  return (
    <SafeAreaView style={shellStyles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={navigation.goBack} style={shellStyles.backButton}>
            <IconFont name="icon-back" size={20} color={colors.brand} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? '关闭搜索' : '搜索聊天记录'}
            onPress={() => {
              setSearchOpen((value) => !value)
              setSearchResults(null)
            }}
            style={styles.headerAction}
          >
            <IconFont name="icon-search" size={20} color={colors.brand} />
          </Pressable>
        </View>

        {searchOpen ? (
          <View style={styles.searchPanel}>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="搜索聊天内容"
                value={searchText}
                onChangeText={setSearchText}
                placeholder="搜索聊天内容"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => void runSearch()}
                style={styles.searchInput}
                autoFocus
              />
              <Pressable accessibilityRole="button" accessibilityLabel="搜索" onPress={() => void runSearch()} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>{searching ? '搜索中' : '搜索'}</Text>
              </Pressable>
            </View>
            {searchResults ? (
              <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
                {searchResults.length === 0 ? <Text style={styles.searchEmpty}>未找到相关消息</Text> : null}
                {searchResults.map((result) => (
                  <Pressable key={result.id} accessibilityRole="button" onPress={() => openSearchResult(result.id)} style={styles.searchResult}>
                    <Text style={styles.searchResultName}>{result.isMine ? '我' : result.chatUserProfile?.name || '对方'}</Text>
                    <Text style={styles.searchResultText} numberOfLines={2}>{buildMessagePreview(result)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.list}
          onScroll={onScroll}
          scrollEventThrottle={64}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (nearBottomRef.current && !pendingScrollIdRef.current) scrollRef.current?.scrollToEnd({ animated: false })
          }}
        >
          {loading && messages.length === 0 ? <LoadingState /> : null}
          {hasMore ? (
            <Pressable accessibilityRole="button" accessibilityLabel="加载更早消息" disabled={loadingMore} onPress={() => void loadOlder()} style={styles.loadMore}>
              <Text style={styles.loadMoreText}>{loadingMore ? '加载中…' : '加载更早消息'}</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.warning}>{messages.length > 0 ? `同步失败：${error}` : error}</Text> : null}
          {!loading && !error && messages.length === 0 ? <Text style={styles.empty}>暂无消息，发送第一条消息吧。</Text> : null}
          {messages.map((message) => (
            <View key={message.id} onLayout={onBubbleLayout(message.id)}>
              <ChatMessageBubble
                message={message}
                highlighted={highlightedId === message.id}
                onLongPress={onMessageLongPress}
                onJumpToMessage={onJumpToMessage}
                onPreviewImage={setPreviewUrl}
                onPlayVideo={setVideoTarget}
                onOpenFile={onOpenFile}
              />
            </View>
          ))}
        </ScrollView>

        {anchored ? (
          <Pressable accessibilityRole="button" accessibilityLabel="回到最新消息" onPress={() => void backToLatest()} style={styles.backToLatest}>
            <Text style={styles.backToLatestText}>回到最新消息</Text>
          </Pressable>
        ) : null}

        <View style={styles.composer}>
          {replyTarget ? (
            <View style={styles.replyBar}>
              <View style={styles.replyBody}>
                <Text style={styles.replyName} numberOfLines={1}>回复 {replyTarget.isMine ? '我' : replyTarget.chatUserProfile?.name || '对方'}</Text>
                <Text style={styles.replyText} numberOfLines={1}>{buildMessagePreview(replyTarget)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="取消回复" onPress={() => setReplyTarget(null)} style={styles.iconButton}>
                <Text style={styles.replyClose}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="发送图片" disabled={!roomId || uploadingImage} onPress={() => void sendImage()} style={[styles.iconButton, uploadingImage && styles.disabled]}>
              <IconFont name="icon-picture" size={22} color={colors.brand} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="引用训练视频" disabled={!roomId || !videoStudentId} onPress={() => setVideoPickerOpen(true)} style={[styles.iconButton, !videoStudentId && styles.disabled]}>
              <IconFont name="icon-video" size={22} color={colors.brand} />
            </Pressable>
            <TextInput
              accessibilityLabel="输入消息"
              value={input}
              onChangeText={setInput}
              placeholder="输入消息"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="发送" disabled={!input.trim() || sending || !roomId} onPress={submitText} style={[styles.sendButton, (!input.trim() || sending) && styles.disabled]}>
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ChatVideoPicker visible={videoPickerOpen} studentId={videoStudentId} onClose={() => setVideoPickerOpen(false)} onSend={(videos) => void sendVideoReferences(videos)} />
      <ImagePreviewModal
        urls={messages.filter((item) => item.messageType === 'image' && item.mediaUrl).map((item) => String(item.mediaUrl))}
        initialUrl={previewUrl}
        onClose={() => setPreviewUrl(null)}
      />
      <VideoPlayerModal target={videoTarget} onClose={() => setVideoTarget(null)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPanel: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  searchButton: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  searchButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  searchResults: {
    maxHeight: 240,
  },
  searchEmpty: {
    color: colors.textTertiary,
    fontSize: 13,
    paddingVertical: spacing.xs,
  },
  searchResult: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  searchResultName: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '600',
  },
  searchResultText: {
    color: colors.text,
    fontSize: 14,
  },
  list: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  loadMore: {
    alignSelf: 'center',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  warning: {
    color: '#9A3412',
    backgroundColor: '#FFF7ED',
    borderRadius: radius.md,
    padding: spacing.xs,
    fontSize: 13,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  backToLatest: {
    position: 'absolute',
    right: spacing.sm,
    bottom: 96,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  backToLatestText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
  composer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    borderRadius: radius.sm,
    backgroundColor: colors.brandSoft,
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyName: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '600',
  },
  replyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  replyClose: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '700',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 128,
    paddingHorizontal: spacing.sm,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  sendButton: {
    minHeight: 48,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  sendText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
})
