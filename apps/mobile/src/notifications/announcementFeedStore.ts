/**
 * 平台公告的共享数据：训练首页、我的、通知列表、详情页读同一份缓存，
 * 详情页标记已读后其他页面的红点立刻同步。和小程序 announcementService 同一套语义。
 * 这里不直接依赖 React Native，方便在 Vitest 里注入假的请求函数测试。
 */

/** 与 Web `src/lib/announcements.ts` 的 UserAnnouncement 保持一致。 */
export type UserAnnouncement = {
  id: string
  title: string
  summary: string
  content: string
  coverImageUrl: string | null
  imageUrls: string[]
  actionLabel: string
  weappPath: string
  webPath: string
  pinned: boolean
  publishedAt: string | null
  isRead: boolean
  shouldPopup: boolean
}

export type AnnouncementFeed = {
  items: UserAnnouncement[]
  unreadCount: number
  popupIds: string[]
}

export const EMPTY_ANNOUNCEMENT_FEED: AnnouncementFeed = { items: [], unreadCount: 0, popupIds: [] }

type Listener = (feed: AnnouncementFeed) => void

export type AnnouncementFeedDeps = {
  fetchFeed: () => Promise<AnnouncementFeed>
  postMark: (ids: string[], kind: 'popped' | 'read') => Promise<void>
  now?: () => number
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/** 接口数据进入缓存前做一次收口，坏数据不会让页面渲染崩掉。 */
export function normalizeAnnouncementFeed(raw: unknown): AnnouncementFeed {
  if (!raw || typeof raw !== 'object') return EMPTY_ANNOUNCEMENT_FEED
  const record = raw as Record<string, unknown>
  const items = (Array.isArray(record.items) ? record.items : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && typeof (item as any).id === 'string')
    .map((item) => ({
      id: String(item.id),
      title: text(item.title) || '平台通知',
      summary: text(item.summary),
      content: text(item.content),
      coverImageUrl: text(item.coverImageUrl) || null,
      imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0) : [],
      actionLabel: text(item.actionLabel),
      weappPath: text(item.weappPath),
      webPath: text(item.webPath),
      pinned: item.pinned === true,
      publishedAt: text(item.publishedAt) || null,
      isRead: item.isRead === true,
      shouldPopup: item.shouldPopup === true,
    }))
  const ids = new Set(items.map((item) => item.id))
  const popupIds = (Array.isArray(record.popupIds) ? record.popupIds : [])
    .filter((id): id is string => typeof id === 'string' && ids.has(id))
  const unreadCount = items.filter((item) => !item.isRead).length
  return { items, unreadCount, popupIds }
}

export function createAnnouncementFeedStore(deps: AnnouncementFeedDeps) {
  const now = deps.now || (() => Date.now())
  let cache: AnnouncementFeed = EMPTY_ANNOUNCEMENT_FEED
  let loadedAt = 0
  let inflight: Promise<AnnouncementFeed> | null = null
  /** 切换账号时作废还在路上的旧请求，避免把上一个账号的公告写回缓存。 */
  let generation = 0
  /** 本次启动已弹过的公告：「已弹出」上报还没落库时快速返回首页，也不会重复弹。 */
  const poppedThisLaunch = new Set<string>()
  const listeners = new Set<Listener>()

  function emit(next: AnnouncementFeed) {
    cache = next
    listeners.forEach((listener) => listener(next))
  }

  function report(ids: string[], kind: 'popped' | 'read') {
    if (ids.length === 0) return
    deps.postMark(ids, kind).catch(() => undefined)
  }

  return {
    getCached(): AnnouncementFeed {
      return cache
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** maxAgeMs 内已加载过就直接用缓存；请求失败时保留旧缓存。 */
    async load(maxAgeMs = 0): Promise<AnnouncementFeed> {
      if (maxAgeMs > 0 && loadedAt > 0 && now() - loadedAt < maxAgeMs) return cache
      if (inflight) return inflight
      const requestGeneration = generation
      const run = async () => {
        try {
          const feed = normalizeAnnouncementFeed(await deps.fetchFeed())
          if (requestGeneration !== generation) return cache
          loadedAt = now()
          // 本次启动已弹过的公告在「已弹出」落库前可能还会出现在 popupIds 里。
          emit({ ...feed, popupIds: feed.popupIds.filter((id) => !poppedThisLaunch.has(id)) })
          return cache
        } catch {
          return cache
        } finally {
          // reset() 之后发起的新请求不能被旧请求的收尾清掉。
          if (requestGeneration === generation) inflight = null
        }
      }
      inflight = run()
      return inflight
    },

    /** 取出本次需要弹出的公告，并立刻记为已弹出（每人只弹一次，关闭也算）。 */
    takePopups(): UserAnnouncement[] {
      if (cache.popupIds.length === 0) return []
      const byId = new Map(cache.items.map((item) => [item.id, item]))
      const popups = cache.popupIds
        .filter((id) => !poppedThisLaunch.has(id))
        .map((id) => byId.get(id))
        .filter((item): item is UserAnnouncement => Boolean(item))
      emit({ ...cache, popupIds: [] })
      popups.forEach((item) => poppedThisLaunch.add(item.id))
      report(popups.map((item) => item.id), 'popped')
      return popups
    },

    markRead(id: string) {
      const target = cache.items.find((item) => item.id === id)
      if (!target || target.isRead) return
      emit({
        ...cache,
        items: cache.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        unreadCount: Math.max(0, cache.unreadCount - 1),
      })
      report([id], 'read')
    },

    markAllRead() {
      const unreadIds = cache.items.filter((item) => !item.isRead).map((item) => item.id)
      if (unreadIds.length === 0) return
      emit({
        ...cache,
        items: cache.items.map((item) => (item.isRead ? item : { ...item, isRead: true })),
        unreadCount: 0,
      })
      report(unreadIds, 'read')
    },

    /** 退出登录 / 切换账号时清空。 */
    reset() {
      generation += 1
      loadedAt = 0
      inflight = null
      poppedThisLaunch.clear()
      emit(EMPTY_ANNOUNCEMENT_FEED)
    },
  }
}

export type AnnouncementFeedStore = ReturnType<typeof createAnnouncementFeedStore>
