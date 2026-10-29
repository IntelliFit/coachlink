/**
 * 聊天消息的纯逻辑：预览文案、引用回复、视频引用卡片文案、元数据角标。
 * 与小程序 `me/messages/chat/index.tsx` 的同名函数保持一致。
 */
import type { CachedChatMessage } from './chatMessageCache'

export type ChatMessage = CachedChatMessage

export type ReplyQuote = {
  id: string
  senderId: string
  senderName: string
  messageType: string
  contentPreview: string
  mediaUrl?: string | null
}

export type VideoReference = {
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
}

/** /api/chat/list-student-videos 返回的条目（id 对应引用里的 videoId）。 */
export type StudentVideoItem = Omit<VideoReference, 'videoId'> & { id: string }

const PREVIEW_MAX_LENGTH = 120

export function buildMessagePreview(message: Pick<ChatMessage, 'content' | 'messageType' | 'mediaUrl'>): string {
  const text = String(message.content || '').trim()
  if (text) return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH)}...` : text
  switch (message.messageType) {
    case 'image': return '[图片]'
    case 'video': return '[视频]'
    case 'voice': return '[语音]'
    case 'file': return '[文件]'
    case 'video_reference': return '[视频引用]'
    default: return message.mediaUrl ? '[媒体消息]' : '[消息]'
  }
}

export function buildReplyQuote(message: ChatMessage): ReplyQuote {
  return {
    id: message.id,
    senderId: String(message.chatUserId || ''),
    senderName: message.isMine ? '我' : String(message.chatUserProfile?.name || '用户'),
    messageType: String(message.messageType || 'text'),
    contentPreview: buildMessagePreview(message),
    mediaUrl: message.mediaUrl ?? null,
  }
}

export function readReplyQuote(message: Pick<ChatMessage, 'contentMetadata'>): ReplyQuote | null {
  const raw = message.contentMetadata?.reply_to_message as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  return {
    id: raw.id,
    senderId: typeof raw.senderId === 'string' ? raw.senderId : '',
    senderName: typeof raw.senderName === 'string' && raw.senderName ? raw.senderName : '用户',
    messageType: typeof raw.messageType === 'string' ? raw.messageType : 'text',
    contentPreview: typeof raw.contentPreview === 'string' ? raw.contentPreview : '[消息]',
    mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl : null,
  }
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function readVideoReferences(message: Pick<ChatMessage, 'contentMetadata'>): VideoReference[] {
  const raw = message.contentMetadata?.video_references
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && typeof (item as any).videoId === 'string')
    .map((item) => ({
      videoId: String(item.videoId),
      videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : '',
      thumbnailUrl: typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : null,
      actionName: typeof item.actionName === 'string' && item.actionName ? item.actionName : '训练视频',
      sourceType: item.sourceType as VideoReference['sourceType'],
      setNumber: Number(item.setNumber) > 0 ? Math.floor(Number(item.setNumber)) : 1,
      weight: finiteOrNull(item.weight),
      reps: finiteOrNull(item.reps),
      isProgress: item.isProgress === true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      dayIndex: finiteOrNull(item.dayIndex),
    }))
}

export function videoItemToReference(video: StudentVideoItem): VideoReference {
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
  }
}

function isTrainingVideoReference(video: Pick<VideoReference, 'videoId' | 'sourceType' | 'dayIndex' | 'weight' | 'reps'>) {
  if (video.sourceType === 'execution_set' || video.sourceType === 'training_video') return true
  if (video.sourceType === 'video_collection' || String(video.videoId || '').startsWith('vc:')) return false
  return Number(video.dayIndex || 0) > 0 || video.weight !== null || video.reps !== null
}

function formatBeijingTrainingDate(value?: string | null) {
  const timestamp = Date.parse(String(value || ''))
  if (!Number.isFinite(timestamp)) return '--'
  const date = new Date(timestamp + 8 * 60 * 60 * 1000)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}年${month}月${day}日`
}

export function buildVideoTrainingStats(video: VideoReference) {
  if (!isTrainingVideoReference(video)) return '个人视频'
  const weight = video.weight !== null ? `${video.weight}kg` : '--kg'
  const reps = video.reps !== null ? `${video.reps}次` : '--次'
  return `第 ${video.setNumber} 组 · 训练重量 ${weight} · ${reps}`
}

export function buildVideoDateLabel(video: VideoReference) {
  const prefix = isTrainingVideoReference(video) ? '训练日期' : '上传日期'
  const dayIndex = Number(video.dayIndex)
  const planDay = Number.isFinite(dayIndex) && dayIndex > 0 ? ` · 计划第 ${Math.floor(dayIndex)} 天` : ''
  return `${prefix} ${formatBeijingTrainingDate(video.createdAt)}${planDay}`
}

export function videoReferenceSummary(videos: VideoReference[]) {
  if (videos.length === 1) return `[视频] ${videos[0].actionName}`
  return `[${videos.length}个视频]`
}

export function messageMetadataBadge(message: Pick<ChatMessage, 'contentMetadata'>): string {
  if (message.contentMetadata?.coach_ai_auto_reply) return '教练 AI 自动回复'
  if (message.contentMetadata?.broadcast) return '群发通知'
  return ''
}

/** 最新一条已落库消息的 id，用于判断是否需要再上报已读。 */
export function latestStableMessageId(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const id = String(messages[index].id || '')
    if (id && !id.startsWith('temp-')) return id
  }
  return ''
}
