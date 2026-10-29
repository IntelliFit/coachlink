import { useEffect, useState } from 'react'
import { formatBeijingDate } from '@coachlink/core/src/beijingTime'
import { apiClient } from '../api'
import { createAnnouncementFeedStore, type AnnouncementFeed } from './announcementFeedStore'

export type { AnnouncementFeed, UserAnnouncement } from './announcementFeedStore'

export const announcementFeed = createAnnouncementFeedStore({
  fetchFeed: () => apiClient.request<AnnouncementFeed>('/api/announcements', { method: 'GET', timeoutMs: 12_000 }),
  postMark: async (ids, kind) => {
    await apiClient.request('/api/announcements/mark', { method: 'POST', body: { ids, kind }, timeoutMs: 10_000 })
  },
})

/** 订阅共享的公告数据；加载由 MessageCenterProvider 和各页面按需触发。 */
export function useAnnouncementFeed(): AnnouncementFeed {
  const [feed, setFeed] = useState<AnnouncementFeed>(() => announcementFeed.getCached())
  useEffect(() => {
    setFeed(announcementFeed.getCached())
    return announcementFeed.subscribe(setFeed)
  }, [])
  return feed
}

export function formatAnnouncementDate(iso: string | null | undefined, withTime = false) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return ''
  return formatBeijingDate(iso, 'zh-CN', withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' })
}
