import type { MessageItem } from '@/services/chatService'
import { appStorageGetJSON, appStorageKey, appStorageRemove, appStorageSetJSON } from './appStorage'

export const CHAT_MESSAGES_CACHE_VERSION = 1 as const

/** 单会话最多缓存条数，避免逼近小程序单 key / 总存储上限 */
export const MAX_CACHED_MESSAGES_PER_ROOM = 200

export interface ChatMessagesCachePayload {
  v: typeof CHAT_MESSAGES_CACHE_VERSION
  roomId: string
  updatedAt: string
  messages: MessageItem[]
  hasMore: boolean
}

export function chatMessagesCacheKey(userId: string, roomId: string): string {
  return appStorageKey('chat', 'messages', userId, roomId)
}

export function getChatMessagesCache(userId: string, roomId: string): ChatMessagesCachePayload | null {
  if (!userId || !roomId) return null
  const raw = appStorageGetJSON<ChatMessagesCachePayload>(chatMessagesCacheKey(userId, roomId))
  if (!raw || raw.v !== CHAT_MESSAGES_CACHE_VERSION || raw.roomId !== roomId) return null
  if (!Array.isArray(raw.messages)) return null
  return raw
}

export function setChatMessagesCache(
  userId: string,
  roomId: string,
  partial: { messages: MessageItem[]; hasMore: boolean; updatedAt?: string }
): boolean {
  if (!userId || !roomId) return false
  let { messages } = partial
  if (messages.length > MAX_CACHED_MESSAGES_PER_ROOM) {
    messages = messages.slice(messages.length - MAX_CACHED_MESSAGES_PER_ROOM)
  }
  const payload: ChatMessagesCachePayload = {
    v: CHAT_MESSAGES_CACHE_VERSION,
    roomId,
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
    messages,
    hasMore: partial.hasMore
  }
  return appStorageSetJSON(chatMessagesCacheKey(userId, roomId), payload)
}

export function clearChatMessagesCache(userId: string, roomId: string): void {
  if (!userId || !roomId) return
  appStorageRemove(chatMessagesCacheKey(userId, roomId))
}

/**
 * 将服务端返回的「最新一页」（时间正序）与本地列表合并：
 * - 保留本地已加载的更旧消息（上滑 loadMore）
 * - 保留发送中的乐观消息 temp-*
 * - 与当前页重叠的 id 以服务端为准（隐含在 serverPage 中）
 */
export function mergeServerLatestPage(cached: MessageItem[], serverPage: MessageItem[]): MessageItem[] {
  const optimistic = cached.filter(m => String(m.id).startsWith('temp-'))
  const cachedNoTemp = cached.filter(m => !String(m.id).startsWith('temp-'))

  if (!serverPage.length) {
    return [...cachedNoTemp, ...optimistic]
  }

  const serverIds = new Set(serverPage.map(m => m.id))
  const oldestServer = new Date(serverPage[0].createdAt).getTime()
  const olderFromCache = cachedNoTemp.filter(m => {
    if (serverIds.has(m.id)) return false
    return new Date(m.createdAt).getTime() < oldestServer
  })

  return [...olderFromCache, ...serverPage, ...optimistic]
}
