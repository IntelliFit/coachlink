import React, { useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './VideoCollectionSection.scss'
import { ArrowRight, Video } from '@nutui/icons-react-taro'

interface VideoCollectionSectionProps {
  videos?: any[]
}

const formatDate = (value?: string) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return ''
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m <= 0) return `${s}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

const VideoCollectionSection: React.FC<VideoCollectionSectionProps> = ({ videos }) => {
  const list = useMemo(() => {
    const source = Array.isArray(videos) ? videos : []
    return source
      .filter((item) => !!item?.video_url)
      .sort((a, b) => {
        const ta = new Date(a?.created_at || 0).getTime()
        const tb = new Date(b?.created_at || 0).getTime()
        return tb - ta
      })
  }, [videos])

  const handlePlay = (url?: string) => {
    if (!url) {
      Taro.showToast({ title: '视频地址无效', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/common/common/video-player?url=${encodeURIComponent(url)}`
    })
  }

  if (list.length === 0) {
    return (
      <View className='video-collection-section'>
        <View className='video-empty'>
          <View className='video-empty-icon'><Video /></View>
          <Text className='video-empty-title'>暂无训练视频</Text>
          <Text className='video-empty-desc'>训练执行中上传视频后，会自动显示在这里</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='video-collection-section'>
      <View className='video-list'>
        {list.map((item) => {
          const title = String(item?.exercise_name || '训练视频').trim() || '训练视频'
          const note = String(item?.user_notes || '').trim()
          const createdAt = formatDate(item?.created_at)
          const duration = formatDuration(item?.duration_seconds)
          const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean).slice(0, 3) : []

          return (
            <View key={item.id || `${item.video_url}-${item.created_at}`} className='video-card'>
              <View className='video-cover' onClick={() => handlePlay(item?.video_url)}>
                {item?.thumbnail_url ? (
                  <Image className='cover-image' src={item.thumbnail_url} mode='aspectFill' />
                ) : (
                  <View className='cover-fallback'>
                    <View className='cover-fallback-icon'><ArrowRight /></View>
                  </View>
                )}
                <View className='cover-overlay'>
                  <View className='play-icon'><ArrowRight /></View>
                </View>
                <View className='cover-badge'>
                  <Text>{item?.type || 'training'}</Text>
                </View>
                {duration && (
                  <View className='cover-duration'>
                    <Text>{duration}</Text>
                  </View>
                )}
              </View>

              <View className='video-info'>
                <Text className='video-title'>{title}</Text>
                {!!note && <Text className='video-note'>{note}</Text>}

                {tags.length > 0 && (
                  <View className='video-tags'>
                    {tags.map((tag: string) => (
                      <View key={`${item.id || item.video_url}-${tag}`} className='video-tag'>
                        <Text>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View className='video-meta-row'>
                  <Text className='video-meta'>上传于 {createdAt}</Text>
                  <Text className='video-play-btn' onClick={() => handlePlay(item?.video_url)}>播放</Text>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default VideoCollectionSection
