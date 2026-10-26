import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Megaphone } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { openAnnouncementDetail } from '@/components/AnnouncementPopup'
import { announcementService } from '@/services/announcementService'
import { useAnnouncementFeed } from '@/hooks/useAnnouncementFeed'
import { formatAnnouncementDate } from '@/utils/announcementDate'
import './index.scss'

function AnnouncementsPage() {
  const { items } = useAnnouncementFeed()
  const [loading, setLoading] = useState(items.length === 0)

  const load = async () => {
    try {
      await announcementService.load()
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(async () => {
    await load()
    Taro.stopPullDownRefresh()
  })

  return (
    <PageThemeRoot>
      <View className='announcements-page'>
        {loading && items.length === 0 ? (
          <Text className='announcements-page__empty'>加载中…</Text>
        ) : items.length === 0 ? (
          <Text className='announcements-page__empty'>暂时没有通知</Text>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              className='announcement-row'
              hoverClass='announcement-row--pressed'
              onClick={() => openAnnouncementDetail(item.id)}
            >
              {item.coverImageUrl ? (
                <Image className='announcement-row__thumb' src={item.coverImageUrl} mode='aspectFill' />
              ) : (
                <View className='announcement-row__thumb announcement-row__thumb--placeholder'>
                  <Icon component={Megaphone} size={28} color='#CF6D4E' />
                </View>
              )}
              <View className='announcement-row__copy'>
                <View className='announcement-row__head'>
                  {!item.isRead && <View className='announcement-row__dot' />}
                  {item.pinned && <Text className='announcement-row__pin'>置顶</Text>}
                  <Text className={`announcement-row__title ${item.isRead ? '' : 'announcement-row__title--unread'}`}>
                    {item.title}
                  </Text>
                </View>
                {!!(item.summary || item.content) && (
                  <Text className='announcement-row__summary'>{item.summary || item.content}</Text>
                )}
                {!!item.publishedAt && (
                  <Text className='announcement-row__date cl-num'>{formatAnnouncementDate(item.publishedAt)}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </PageThemeRoot>
  )
}

export default AnnouncementsPage
