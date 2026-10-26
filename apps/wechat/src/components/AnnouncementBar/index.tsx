import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Megaphone } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { useAnnouncementFeed } from '@/hooks/useAnnouncementFeed'
import './index.scss'

/** 首页顶部的通知入口：有未读时高亮并显示条数和最新一条标题，点进通知列表。 */
function AnnouncementBar() {
  const { items, unreadCount } = useAnnouncementFeed()
  if (items.length === 0) return null

  const latest = items.find((item) => !item.isRead) || items[0]
  const hasUnread = unreadCount > 0

  return (
    <View
      className={`announcement-bar ${hasUnread ? 'announcement-bar--unread' : ''}`}
      hoverClass='announcement-bar--pressed'
      onClick={() => Taro.navigateTo({ url: '/me/announcements/index' })}
    >
      <View className='announcement-bar__icon'>
        <Icon component={Megaphone} size={18} color={hasUnread ? '#FFFFFF' : '#CF6D4E'} />
        {hasUnread && <View className='announcement-bar__dot' />}
      </View>
      <Text className='announcement-bar__title'>{latest.title}</Text>
      {hasUnread && (
        <Text className='announcement-bar__count cl-num'>{unreadCount > 99 ? '99+' : unreadCount} 条新通知</Text>
      )}
      <Text className='announcement-bar__arrow'>›</Text>
    </View>
  )
}

export default AnnouncementBar
