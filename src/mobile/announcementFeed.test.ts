import { describe, expect, it, vi } from 'vitest'
import {
  createAnnouncementFeedStore,
  normalizeAnnouncementFeed,
  type AnnouncementFeed,
} from '../../apps/mobile/src/notifications/announcementFeedStore'
import { resolveWeappPathToAppTarget, resolveWebPathToUrl } from '../../apps/mobile/src/notifications/announcementLinks'
import { parseNotificationTarget } from '../../apps/mobile/src/notifications/notificationTargets'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `通知 ${id.slice(0, 4)}`,
    summary: '',
    content: '正文',
    coverImageUrl: null,
    imageUrls: [],
    actionLabel: '',
    weappPath: '',
    webPath: '',
    pinned: false,
    publishedAt: '2026-10-27T02:00:00.000Z',
    isRead: false,
    shouldPopup: false,
    ...overrides,
  }
}

function feed(items: ReturnType<typeof item>[], popupIds: string[] = []): AnnouncementFeed {
  return { items, unreadCount: items.filter((entry) => !entry.isRead).length, popupIds }
}

describe('mobile announcement feed store', () => {
  it('normalizes broken payloads and recomputes unread count', () => {
    const normalized = normalizeAnnouncementFeed({
      items: [item(ID_A), null, { title: 'no id' }, item(ID_B, { isRead: true, imageUrls: ['https://a/1.png', 3] })],
      unreadCount: 99,
      popupIds: [ID_A, 'missing'],
    })
    expect(normalized.items.map((entry) => entry.id)).toEqual([ID_A, ID_B])
    expect(normalized.unreadCount).toBe(1)
    expect(normalized.popupIds).toEqual([ID_A])
    expect(normalized.items[1].imageUrls).toEqual(['https://a/1.png'])
    expect(normalizeAnnouncementFeed(null)).toEqual({ items: [], unreadCount: 0, popupIds: [] })
  })

  it('pops each announcement once per launch and reports it', async () => {
    const postMark = vi.fn(async () => undefined)
    const fetchFeed = vi.fn(async () => feed([item(ID_A), item(ID_B)], [ID_A, ID_B]))
    const store = createAnnouncementFeedStore({ fetchFeed, postMark })

    await store.load()
    expect(store.takePopups().map((entry) => entry.id)).toEqual([ID_A, ID_B])
    expect(postMark).toHaveBeenCalledWith([ID_A, ID_B], 'popped')

    // 服务端还没落库「已弹出」时，再次加载也不应重复弹。
    await store.load()
    expect(store.takePopups()).toEqual([])
    expect(postMark).toHaveBeenCalledTimes(1)
  })

  it('marks read optimistically and notifies subscribers', async () => {
    const postMark = vi.fn(async () => undefined)
    const store = createAnnouncementFeedStore({ fetchFeed: async () => feed([item(ID_A), item(ID_B)]), postMark })
    const seen: number[] = []
    store.subscribe((next) => seen.push(next.unreadCount))

    await store.load()
    store.markRead(ID_A)
    store.markRead(ID_A)
    expect(store.getCached().unreadCount).toBe(1)
    expect(postMark).toHaveBeenCalledTimes(1)

    store.markAllRead()
    expect(store.getCached().unreadCount).toBe(0)
    expect(postMark).toHaveBeenLastCalledWith([ID_B], 'read')
    expect(seen).toEqual([2, 1, 0])
  })

  it('keeps cache on fetch failure and honors max age', async () => {
    let calls = 0
    let now = 1_000
    const store = createAnnouncementFeedStore({
      fetchFeed: async () => {
        calls += 1
        if (calls === 2) throw new Error('offline')
        return feed([item(ID_A)])
      },
      postMark: async () => undefined,
      now: () => now,
    })
    await store.load()
    await store.load(60_000)
    expect(calls).toBe(1)
    now += 61_000
    await store.load(60_000)
    expect(calls).toBe(2)
    expect(store.getCached().items).toHaveLength(1)
  })

  it('drops a response that lands after an account switch', async () => {
    let resolveFeed: (value: AnnouncementFeed) => void = () => undefined
    const store = createAnnouncementFeedStore({
      fetchFeed: () => new Promise<AnnouncementFeed>((resolve) => { resolveFeed = resolve }),
      postMark: async () => undefined,
    })
    const pending = store.load()
    store.reset()
    resolveFeed(feed([item(ID_A)], [ID_A]))
    await pending
    expect(store.getCached().items).toEqual([])
  })
})

describe('mobile announcement links', () => {
  it('maps mini-program paths to native routes with params', () => {
    expect(resolveWeappPathToAppTarget('/toolbox/power-analysis/index')).toEqual({ kind: 'stack', name: 'PowerAnalysis' })
    expect(resolveWeappPathToAppTarget('/discovery/coach-profile?id=abc')).toEqual({ kind: 'stack', name: 'CoachProfile', params: { id: 'abc' } })
    expect(resolveWeappPathToAppTarget('/discovery/coach-profile?coachId=xyz')).toEqual({ kind: 'stack', name: 'CoachProfile', params: { id: 'xyz' } })
    expect(resolveWeappPathToAppTarget('/pages/index/index')).toEqual({ kind: 'tab', mode: 'student', tab: 'TrainingTab' })
    expect(resolveWeappPathToAppTarget('/coach/students')).toEqual({ kind: 'tab', mode: 'coach', tab: 'CoachStudentsTab' })
  })

  it('rejects unknown, empty and protocol-relative paths', () => {
    expect(resolveWeappPathToAppTarget('/unknown/page')).toBeNull()
    expect(resolveWeappPathToAppTarget('')).toBeNull()
    expect(resolveWeappPathToAppTarget('//evil.example/x')).toBeNull()
    expect(resolveWeappPathToAppTarget('toolbox/index')).toBeNull()
  })

  it('builds web fallbacks only for site paths and https links', () => {
    expect(resolveWebPathToUrl('/toolbox', 'https://coachlink.fit/')).toBe('https://coachlink.fit/toolbox')
    expect(resolveWebPathToUrl('https://example.com/a', 'https://coachlink.fit')).toBe('https://example.com/a')
    expect(resolveWebPathToUrl('http://example.com/a', 'https://coachlink.fit')).toBeNull()
    expect(resolveWebPathToUrl('//evil.example', 'https://coachlink.fit')).toBeNull()
    expect(resolveWebPathToUrl('', 'https://coachlink.fit')).toBeNull()
  })
})

describe('mobile notification targets', () => {
  it('routes known kinds and validates ids', () => {
    expect(parseNotificationTarget({ kind: 'chat_message', roomId: ID_A })).toEqual({ name: 'Chat', params: { roomId: ID_A } })
    expect(parseNotificationTarget({ kind: 'chat_message', roomId: 'not-a-uuid' })).toEqual({ name: 'Messages' })
    expect(parseNotificationTarget({ kind: 'announcement', announcementId: ID_B })).toEqual({ name: 'AnnouncementDetail', params: { id: ID_B } })
    expect(parseNotificationTarget({ kind: 'announcement' })).toEqual({ name: 'Announcements' })
    expect(parseNotificationTarget({ kind: 'friend_request' })).toEqual({ name: 'Friends', params: { tab: 'requests' } })
    expect(parseNotificationTarget({ kind: 'coach_payment_pending' })).toEqual({ name: 'CoachPayments' })
    expect(parseNotificationTarget({ kind: 'something_new' })).toEqual({ name: 'Messages' })
    expect(parseNotificationTarget({})).toBeNull()
    expect(parseNotificationTarget(undefined)).toBeNull()
  })
})
