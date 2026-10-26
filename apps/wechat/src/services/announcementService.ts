import { request } from '@/utils/request'

/** 与 Web `src/lib/announcements.ts` 的 UserAnnouncement 保持一致。 */
export interface UserAnnouncement {
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

export interface AnnouncementFeed {
  items: UserAnnouncement[]
  unreadCount: number
  popupIds: string[]
}

const EMPTY_FEED: AnnouncementFeed = { items: [], unreadCount: 0, popupIds: [] }

type Listener = (feed: AnnouncementFeed) => void

/**
 * 页面间共享同一份公告数据：首页、我的、列表页、详情页读的是同一个缓存，
 * 详情页标记已读后其他页面的红点立刻同步。
 */
let cache: AnnouncementFeed = EMPTY_FEED
let loadedAt = 0
let inflight: Promise<AnnouncementFeed> | null = null
/** 本次启动已弹过的公告：「已弹出」上报还没落库时快速返回首页，也不会重复弹。 */
const poppedThisLaunch = new Set<string>()
const listeners = new Set<Listener>()

function emit(next: AnnouncementFeed) {
  cache = next
  listeners.forEach((listener) => listener(next))
}

async function postMark(ids: string[], kind: 'popped' | 'read') {
  if (ids.length === 0) return
  await request<null>({
    url: '/api/announcements/mark',
    method: 'POST',
    data: { ids, kind },
    showErrorToast: false
  })
}

export const announcementService = {
  getCached(): AnnouncementFeed {
    return cache
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** maxAgeMs 内已加载过就直接用缓存；未登录时接口返回空列表。 */
  async load(maxAgeMs = 0): Promise<AnnouncementFeed> {
    if (maxAgeMs > 0 && loadedAt > 0 && Date.now() - loadedAt < maxAgeMs) return cache
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const res = await request<AnnouncementFeed>({ url: '/api/announcements', method: 'GET', showErrorToast: false })
        if (res.success && res.data) {
          loadedAt = Date.now()
          emit(res.data)
        }
        return cache
      } finally {
        inflight = null
      }
    })()
    return inflight
  },

  /** 取出本次需要弹出的公告，并立刻记为已弹出（每人只弹一次，关闭也算）。 */
  takePopups(): UserAnnouncement[] {
    if (cache.popupIds.length === 0) return []
    const byId = new Map(cache.items.map((item) => [item.id, item]))
    const popups = cache.popupIds
      .filter((id) => !poppedThisLaunch.has(id))
      .map((id) => byId.get(id))
      .filter((item): item is UserAnnouncement => !!item)
    emit({ ...cache, popupIds: [] })
    popups.forEach((item) => poppedThisLaunch.add(item.id))
    if (popups.length === 0) return popups
    void postMark(popups.map((item) => item.id), 'popped')
    return popups
  },

  markRead(id: string) {
    const target = cache.items.find((item) => item.id === id)
    if (!target || target.isRead) return
    emit({
      ...cache,
      items: cache.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      unreadCount: Math.max(0, cache.unreadCount - 1)
    })
    void postMark([id], 'read')
  },

  /** 退出登录 / 切换账号时清空。 */
  reset() {
    loadedAt = 0
    emit(EMPTY_FEED)
  }
}
