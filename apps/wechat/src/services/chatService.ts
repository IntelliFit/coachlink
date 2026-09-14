import { request } from '@/utils/request'

/** 底部栏等订阅：会话未读数变化时触发刷新 */
export const CHAT_UNREAD_BADGE_REFRESH_EVENT = 'coachlink:chat-unread-badge-refresh'

/** 会话列表项（与 Web list-chatrooms 一致） */
export interface ChatroomItem {
  id: string
  chatUserId: string
  chatUserProfile: { name: string; avatar?: string | null }
  lastMessage: string | null
  lastMessageAt: string | null
  unreadMembers: string[]
  unreadCount: number
  isArchived?: boolean
}

/** 会话详情（与 Web get-chatroom 一致） */
export interface ChatroomDetail {
  id: string
  members: string[]
  chatUserProfile?: { name: string; avatar?: string | null }
  lastMessage: string | null
  lastMessageAt: string | null
  unreadMembers: string[]
  isArchived: boolean
}

export interface ChatReplyMetadata {
  id: string
  senderId: string
  senderName: string
  messageType: string
  contentPreview: string
  mediaUrl?: string | null
}

export interface VideoReferenceItem {
  videoId: string
  videoUrl: string
  thumbnailUrl: string | null
  actionName: string
  description?: string | null
  tags?: string[] | null
  sourceType?: 'execution_set' | 'training_video' | 'video_collection'
  setNumber: number
  weight: number | null
  reps: number | null
  isProgress: boolean
  createdAt: string
  dayIndex?: number | null
  studentInfo?: {
    id: string
    fullName: string | null
    nickname: string | null
    avatarUrl: string | null
  }
}

export interface ChatMessageMetadata {
  reply_to_message?: ChatReplyMetadata
  video_references?: VideoReferenceItem[]
  broadcast?: boolean
  contentId?: string
  contentTitle?: string
  contentLink?: string
  coach_ai_auto_reply?: boolean
  virtual_avatar_label?: string
  provider?: string
  model?: string
  [key: string]: unknown
}

/** 单条消息（与 Web list-messages 一致） */
export interface MessageItem {
  id: string
  chatUserId: string
  chatUserProfile: { name: string; avatar: string | null }
  messageType: string
  content: string
  mediaUrl: string | null
  fileName: string | null
  fileSize: number | null
  duration: number | null
  isRead: boolean
  createdAt: string
  isMine: boolean
  contentMetadata?: ChatMessageMetadata | null
}

export interface SearchMessagesResult {
  messages: MessageItem[]
}

export interface VideoItem extends Omit<VideoReferenceItem, 'videoId'> {
  id: string
}

export const chatService = {
  /** 会话列表 */
  async listChatrooms(params: { page?: number; limit?: number }) {
    const res = await request<{ chatRooms: ChatroomItem[]; total?: number }>({
      url: '/api/chat/list-chatrooms',
      method: 'POST',
      data: { page: params.page ?? 1, limit: params.limit ?? 50 }
    })
    if (!res.success || !res.data) return null
    return res.data
  },

  /** 获取或创建会话（members: [myId, peerId]） */
  async getChatroom(params: { members?: string[]; roomId?: string }) {
    const res = await request<{ chatroom: ChatroomDetail | null }>({
      url: '/api/chat/get-chatroom',
      method: 'POST',
      data: params.roomId ? { roomId: params.roomId } : { members: params.members }
    })
    if (!res.success || !res.data) return null
    return res.data.chatroom
  },

  /** 消息列表 */
  async listMessages(params: {
    roomId: string
    limit?: number
    beforeId?: string
    anchorMessageId?: string
  }) {
    const res = await request<{
      messages: MessageItem[]
      has_more: boolean
      total?: number
    }>({
      url: '/api/chat/list-messages',
      method: 'POST',
      data: {
        roomId: params.roomId,
        limit: params.limit ?? 50,
        beforeId: params.beforeId,
        anchorMessageId: params.anchorMessageId
      }
    })
    if (!res.success || !res.data) return null
    return res.data
  },

  async searchMessages(params: { roomId: string; query: string; limit?: number }) {
    const res = await request<SearchMessagesResult>({
      url: '/api/chat/search-messages',
      method: 'POST',
      data: {
        roomId: params.roomId,
        query: params.query,
        limit: params.limit ?? 30
      },
      showErrorToast: false
    })
    if (!res.success || !res.data) return null
    return res.data
  },

  /** 发送消息 */
  async sendMessage(params: {
    roomId: string
    messageType: 'text' | 'image' | 'video_reference'
    content?: string
    mediaUrl?: string
    fileName?: string
    fileSize?: number
    videoReferences?: VideoReferenceItem[]
    replyToMessageId?: string
  }) {
    const res = await request<{ messageId?: string; createdAt?: string }>({
      url: '/api/chat/send-message',
      method: 'POST',
      data: params
    })
    if (!res.success) return null
    return res.data ?? {}
  },

  /** 标记已读 */
  async markAsRead(roomId: string) {
    const res = await request({
      url: '/api/chat/mark-as-read',
      method: 'POST',
      data: { roomId }
    })
    return res.success
  },

  /** 获取学员上传的视频列表 */
  async listStudentVideos(params: {
    studentId?: string
    query?: string
    onlyProgress?: boolean
    page?: number
    pageSize?: number
  }) {
    const res = await request<{
      videos: VideoItem[]
      hasMore: boolean
      total: number
    }>({
      url: '/api/chat/list-student-videos',
      method: 'POST',
      data: params
    })
    if (!res.success || !res.data) return null
    return res.data
  },

  /** 流式发送消息（AI打字机效果） */
  async streamMessage(params: {
    roomId: string
    content: string
    onChunk: (chunk: string) => void
    onComplete?: () => void
    onError?: (error: any) => void
  }) {
    // 当前后端未提供 stream-poll，先做安全降级：普通发送并直接 complete
    const res = await request<{ messageId?: string; createdAt?: string }>({
      url: '/api/chat/send-message',
      method: 'POST',
      data: {
        roomId: params.roomId,
        messageType: 'text',
        content: params.content
      }
    })

    if (!res.success) {
      params.onError?.(new Error(res.message || '发送失败'))
      return null
    }

    // 保持回调契约，避免调用方崩溃
    params.onChunk('')
    params.onComplete?.()
    return res.data ?? {}
  }
}
