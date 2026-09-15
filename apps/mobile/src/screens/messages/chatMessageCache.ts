import AsyncStorage from '@react-native-async-storage/async-storage'

export const CHAT_MESSAGES_CACHE_VERSION = 1 as const
export const CHAT_MESSAGES_CACHE_KEY_PREFIX = 'coachlink_mobile_chat_messages_v1:'
export const MAX_CACHED_MESSAGES_PER_ROOM = 200
export const MAX_CACHED_MESSAGE_AGE_MS = 60 * 24 * 60 * 60 * 1000

export type CachedChatMessage = {
  id: string
  chatUserId?: string
  chatUserProfile?: {
    name?: string | null
    avatar?: string | null
  } | null
  messageType?: string
  content?: string | null
  mediaUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  duration?: number | null
  isRead?: boolean
  createdAt?: string
  isMine?: boolean
  contentMetadata?: Record<string, unknown> | null
  pending?: boolean
  failed?: boolean
}

export type ChatMessagesCachePayload = {
  v: typeof CHAT_MESSAGES_CACHE_VERSION
  roomId: string
  updatedAt: string
  messages: CachedChatMessage[]
  hasMore: boolean
}

export type ChatMessageCacheStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>

export function chatMessagesCacheKey(userId: string, roomId: string): string {
  return `${CHAT_MESSAGES_CACHE_KEY_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(roomId)}`
}

function isRecentMessage(message: CachedChatMessage, now: number): boolean {
  const createdAt = new Date(message.createdAt || '').getTime()
  return Number.isFinite(createdAt) && createdAt >= now - MAX_CACHED_MESSAGE_AGE_MS
}

function trimMessages(messages: CachedChatMessage[], now = Date.now()): CachedChatMessage[] {
  const recent = messages.filter((message) => isRecentMessage(message, now))
  return recent.length > MAX_CACHED_MESSAGES_PER_ROOM
    ? recent.slice(recent.length - MAX_CACHED_MESSAGES_PER_ROOM)
    : recent
}

export async function getChatMessagesCache(
  userId: string,
  roomId: string,
  storage: ChatMessageCacheStorage = AsyncStorage,
  now = Date.now(),
): Promise<ChatMessagesCachePayload | null> {
  if (!userId || !roomId) return null
  const key = chatMessagesCacheKey(userId, roomId)
  try {
    const raw = await storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChatMessagesCachePayload
    if (parsed?.v !== CHAT_MESSAGES_CACHE_VERSION || parsed.roomId !== roomId || !Array.isArray(parsed.messages)) {
      await storage.removeItem(key)
      return null
    }
    return { ...parsed, messages: trimMessages(parsed.messages, now) }
  } catch {
    await storage.removeItem(key).catch(() => undefined)
    return null
  }
}

export async function setChatMessagesCache(
  userId: string,
  roomId: string,
  partial: { messages: CachedChatMessage[]; hasMore: boolean; updatedAt?: string },
  storage: ChatMessageCacheStorage = AsyncStorage,
  now = Date.now(),
): Promise<void> {
  if (!userId || !roomId) return
  const messages = trimMessages(
    partial.messages.filter((message) => !String(message.id).startsWith('temp-')),
    now,
  )
  await storage.setItem(chatMessagesCacheKey(userId, roomId), JSON.stringify({
    v: CHAT_MESSAGES_CACHE_VERSION,
    roomId,
    updatedAt: partial.updatedAt || new Date(now).toISOString(),
    messages,
    hasMore: partial.hasMore,
  } satisfies ChatMessagesCachePayload))
}

export function mergeServerLatestPage(
  cached: CachedChatMessage[],
  serverPage: CachedChatMessage[],
): CachedChatMessage[] {
  const optimistic = cached.filter((message) => String(message.id).startsWith('temp-'))
  const stableCached = cached.filter((message) => !String(message.id).startsWith('temp-'))
  if (!serverPage.length) return [...stableCached, ...optimistic]

  const serverIds = new Set(serverPage.map((message) => message.id))
  const oldestServerTime = new Date(serverPage[0]?.createdAt || '').getTime()
  const olderCached = stableCached.filter((message) => {
    if (serverIds.has(message.id)) return false
    return new Date(message.createdAt || '').getTime() < oldestServerTime
  })
  return [...olderCached, ...serverPage, ...optimistic]
}

export function mergeOlderMessages(
  current: CachedChatMessage[],
  older: CachedChatMessage[],
): CachedChatMessage[] {
  const byId = new Map<string, CachedChatMessage>()
  for (const message of [...older, ...current]) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => (
    new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime()
  ))
}
