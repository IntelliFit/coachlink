import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import { Megaphone, X } from 'lucide-react'
import { Icon } from '@/components/Icon'
import type { UserAnnouncement } from '@/services/announcementService'
import './index.scss'

interface AnnouncementPopupProps {
  items: UserAnnouncement[]
  onClose: () => void
}

export function openAnnouncementDetail(id: string) {
  Taro.navigateTo({ url: `/me/announcements/detail/index?id=${encodeURIComponent(id)}` })
}

/** 打开首页时自动弹出的公告；多条可左右滑，「知道了」逐条看完后关闭。 */
function AnnouncementPopup({ items, onClose }: AnnouncementPopupProps) {
  const [current, setCurrent] = useState(0)
  if (items.length === 0) return null
  const isLast = current >= items.length - 1
  const item = items[Math.min(current, items.length - 1)]

  const openDetail = () => {
    onClose()
    openAnnouncementDetail(item.id)
  }

  return (
    <View className='announcement-popup' catchMove onClick={onClose}>
      <View className='announcement-popup__panel' onClick={(e) => e.stopPropagation()}>
        <View className='announcement-popup__close' onClick={onClose}>
          <Icon component={X} size={18} color='#FFFFFF' />
        </View>
        {items.length > 1 && (
          <Text className='announcement-popup__counter cl-num'>{current + 1} / {items.length}</Text>
        )}

        <Swiper
          className='announcement-popup__swiper'
          current={current}
          onChange={(e) => setCurrent(e.detail.current)}
        >
          {items.map((entry) => (
            <SwiperItem key={entry.id}>
              <View className='announcement-popup__card' onClick={openDetail}>
                {entry.coverImageUrl ? (
                  <Image className='announcement-popup__cover' src={entry.coverImageUrl} mode='aspectFill' />
                ) : (
                  <View className='announcement-popup__cover announcement-popup__cover--placeholder'>
                    <Icon component={Megaphone} size={64} color='#FFFFFF' strokeWidth={1.75} />
                  </View>
                )}
                <View className='announcement-popup__body'>
                  <Text className='announcement-popup__tag'>平台通知</Text>
                  <Text className='announcement-popup__title'>{entry.title}</Text>
                  {!!(entry.summary || entry.content) && (
                    <Text className='announcement-popup__summary'>{entry.summary || entry.content}</Text>
                  )}
                </View>
              </View>
            </SwiperItem>
          ))}
        </Swiper>

        <View className='announcement-popup__actions'>
          <View className='announcement-popup__btn announcement-popup__btn--primary' onClick={openDetail}>
            <Text>查看详情</Text>
          </View>
          <View
            className='announcement-popup__btn announcement-popup__btn--secondary'
            onClick={() => (isLast ? onClose() : setCurrent(current + 1))}
          >
            <Text>{isLast ? '知道了' : '下一条'}</Text>
          </View>
        </View>

        {items.length > 1 && (
          <View className='announcement-popup__dots'>
            {items.map((entry, i) => (
              <View
                key={entry.id}
                className={`announcement-popup__dot ${i === current ? 'announcement-popup__dot--active' : ''}`}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

export default AnnouncementPopup
