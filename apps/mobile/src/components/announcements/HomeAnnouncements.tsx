import { useCallback, useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { announcementFeed, type UserAnnouncement } from '../../notifications/announcementFeed'
import { AnnouncementBar } from './AnnouncementBar'
import { AnnouncementPopup } from './AnnouncementPopup'

/**
 * 首页通知区：顶部通知栏 + 进入首页时自动弹出未弹过的公告。
 * 和小程序今日训练页一致：每次回到首页拉一次，takePopups 取出后立即记为已弹出。
 */
export function HomeAnnouncements({ enabled }: { enabled: boolean }) {
  const navigation = useNavigation<any>()
  const [popups, setPopups] = useState<UserAnnouncement[]>([])

  useFocusEffect(useCallback(() => {
    if (!enabled) return undefined
    let active = true
    void announcementFeed.load().then(() => {
      if (!active) return
      const next = announcementFeed.takePopups()
      if (next.length > 0) setPopups(next)
    })
    return () => {
      active = false
    }
  }, [enabled]))

  if (!enabled) return null

  return (
    <>
      <AnnouncementBar onPress={() => navigation.navigate('Announcements')} />
      {popups.length > 0 ? (
        <AnnouncementPopup
          items={popups}
          onClose={() => setPopups([])}
          onOpenDetail={(id) => navigation.navigate('AnnouncementDetail', { id })}
        />
      ) : null}
    </>
  )
}
