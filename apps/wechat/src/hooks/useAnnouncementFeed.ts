import { useEffect, useState } from 'react'
import { announcementService, type AnnouncementFeed } from '@/services/announcementService'

/** 订阅共享的公告数据（加载由页面在 useDidShow 里调用 announcementService.load 触发）。 */
export function useAnnouncementFeed(): AnnouncementFeed {
  const [feed, setFeed] = useState<AnnouncementFeed>(() => announcementService.getCached())
  useEffect(() => announcementService.subscribe(setFeed), [])
  return feed
}
