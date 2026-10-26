import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ClButton } from '@/components/ui'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { announcementService } from '@/services/announcementService'
import { useAnnouncementFeed } from '@/hooks/useAnnouncementFeed'
import { formatAnnouncementDate } from '@/utils/announcementDate'
import './index.scss'

function openWeappPath(path: string) {
  Taro.navigateTo({ url: path }).catch(() => {
    // 首页等页面不能 navigateTo（页面栈或 tab 限制），退回 reLaunch。
    Taro.reLaunch({ url: path }).catch(() => Taro.showToast({ title: '页面暂时打不开', icon: 'none' }))
  })
}

function AnnouncementDetailPage() {
  const router = useRouter()
  const id = decodeURIComponent(router.params?.id || '')
  const { items } = useAnnouncementFeed()
  const item = items.find((entry) => entry.id === id)
  const [loading, setLoading] = useState(!item)

  useEffect(() => {
    if (item) return
    announcementService.load().then(() => setLoading(false), () => setLoading(false))
    // 只在首次进入且缓存里没有时拉一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (item && !item.isRead) announcementService.markRead(item.id)
  }, [item])

  if (!item) {
    return (
      <PageThemeRoot>
        <View className='announcement-detail'>
          <Text className='announcement-detail__empty'>{loading ? '加载中…' : '这条通知不存在或已下线'}</Text>
        </View>
      </PageThemeRoot>
    )
  }

  const previewImages = [item.coverImageUrl, ...item.imageUrls].filter((url): url is string => !!url)
  const preview = (url: string) => Taro.previewImage({ current: url, urls: previewImages })

  return (
    <PageThemeRoot>
      <View className='announcement-detail'>
        {!!item.coverImageUrl && (
          <Image
            className='announcement-detail__cover'
            src={item.coverImageUrl}
            mode='widthFix'
            onClick={() => preview(item.coverImageUrl as string)}
          />
        )}
        <View className='announcement-detail__body'>
          <Text className='announcement-detail__tag'>平台通知</Text>
          <Text className='announcement-detail__title'>{item.title}</Text>
          {!!item.publishedAt && (
            <Text className='announcement-detail__date cl-num'>{formatAnnouncementDate(item.publishedAt, true)}</Text>
          )}
          {!!item.summary && <Text className='announcement-detail__summary' userSelect>{item.summary}</Text>}
          {!!item.content && <Text className='announcement-detail__content' userSelect>{item.content}</Text>}
          {item.imageUrls.map((url) => (
            <Image
              key={url}
              className='announcement-detail__image'
              src={url}
              mode='widthFix'
              onClick={() => preview(url)}
            />
          ))}
          {!!(item.actionLabel && item.weappPath) && (
            <View className='announcement-detail__action'>
              <ClButton block onClick={() => openWeappPath(item.weappPath)}>{item.actionLabel}</ClButton>
            </View>
          )}
        </View>
      </View>
    </PageThemeRoot>
  )
}

export default AnnouncementDetailPage
