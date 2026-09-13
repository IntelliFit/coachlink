import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CACHED_MESSAGE_AGE_MS,
  MAX_CACHED_MESSAGES_PER_ROOM,
  chatMessagesCacheKey,
  getChatMessagesCache,
  mergeOlderMessages,
  mergeServerLatestPage,
  setChatMessagesCache,
  type CachedChatMessage,
} from '../../apps/mobile/src/screens/messages/chatMessageCache'

const values = new Map<string, string>()
const storageMock = {
  getItem: vi.fn(async (key: string) => values.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    values.set(key, value)
  }),
  removeItem: vi.fn(async (key: string) => {
    values.delete(key)
  }),
}

function message(id: string, createdAt: number, content = id): CachedChatMessage {
  return { id, createdAt: new Date(createdAt).toISOString(), content }
}

describe('mobile chat message cache', () => {
  beforeEach(() => {
    values.clear()
    vi.clearAllMocks()
  })

  it('isolates messages by signed-in user and room', async () => {
    const now = Date.UTC(2026, 8, 8)
    await setChatMessagesCache('user-a', 'room-1', { messages: [message('a', now)], hasMore: false }, storageMock, now)
    await setChatMessagesCache('user-b', 'room-1', { messages: [message('b', now)], hasMore: true }, storageMock, now)

    await expect(getChatMessagesCache('user-a', 'room-1', storageMock, now)).resolves.toMatchObject({
      messages: [{ id: 'a' }],
      hasMore: false,
    })
    await expect(getChatMessagesCache('user-b', 'room-1', storageMock, now)).resolves.toMatchObject({
      messages: [{ id: 'b' }],
      hasMore: true,
    })
    expect(chatMessagesCacheKey('user-a', 'room-1')).not.toBe(chatMessagesCacheKey('user-b', 'room-1'))
  })

  it('keeps at most 200 recent stable messages', async () => {
    const now = Date.UTC(2026, 8, 8)
    const messages = Array.from({ length: MAX_CACHED_MESSAGES_PER_ROOM + 5 }, (_, index) => message(`m-${index}`, now - index))
    messages.unshift(message('expired', now - MAX_CACHED_MESSAGE_AGE_MS - 1))
    messages.push({ ...message('temp-1', now), pending: true })

    await setChatMessagesCache('user-a', 'room-1', { messages, hasMore: true }, storageMock, now)
    const cached = await getChatMessagesCache('user-a', 'room-1', storageMock, now)

    expect(cached?.messages).toHaveLength(MAX_CACHED_MESSAGES_PER_ROOM)
    expect(cached?.messages.some((item) => item.id === 'expired')).toBe(false)
    expect(cached?.messages.some((item) => item.id === 'temp-1')).toBe(false)
  })

  it('merges the latest cloud page while preserving older history and optimistic sends', () => {
    const base = Date.UTC(2026, 8, 8)
    const merged = mergeServerLatestPage(
      [message('older', base), message('same', base + 1, 'local'), { ...message('temp-1', base + 4), pending: true }],
      [message('same', base + 1, 'server'), message('new', base + 3)],
    )

    expect(merged.map((item) => item.id)).toEqual(['older', 'same', 'new', 'temp-1'])
    expect(merged.find((item) => item.id === 'same')?.content).toBe('server')
  })

  it('prepends historical pages without duplicating overlapping messages', () => {
    const base = Date.UTC(2026, 8, 8)
    const merged = mergeOlderMessages(
      [message('m-2', base + 2), message('m-3', base + 3)],
      [message('m-1', base + 1), message('m-2', base + 2, 'older copy')],
    )

    expect(merged.map((item) => item.id)).toEqual(['m-1', 'm-2', 'm-3'])
    expect(merged.find((item) => item.id === 'm-2')?.content).toBe('m-2')
  })
})
