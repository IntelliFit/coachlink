import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Lock } from '@nutui/icons-react-taro'
import type { CoachContentRow } from '../types'
import './ContentSection.scss'

interface ContentSectionProps {
  contents: CoachContentRow[]
  total: number
  onItemClick?: (content: CoachContentRow) => void
}

export default function ContentSection({ contents, total, onItemClick }: ContentSectionProps) {
  return (
    <View className='content-card'>
      <View className='section-header'>
        <Text className='section-title'>教学内容</Text>
        <Text className='section-count'>共 {total} 条</Text>
      </View>
      <View className='content-list'>
        {contents.length === 0 ? (
          <Text className='content-empty'>暂无内容</Text>
        ) : (
          contents.map((c) => {
            const locked = c.is_locked === true
            return (
              <View
                key={c.id}
                className={`content-item ${locked ? 'content-item-locked' : ''}`}
                onClick={() => onItemClick?.(c)}
              >
                <View className='content-thumb'>
                  {c.thumbnail_url ? (
                    <Image
                      src={c.thumbnail_url}
                      mode='aspectFill'
                      className='content-thumb-img'
                      lazyLoad
                    />
                  ) : (
                    <View className='content-thumb-placeholder'>
                      <Text>{c.content_type === 'video' ? '视频' : '图文'}</Text>
                    </View>
                  )}
                  {locked && (
                    <View className='content-thumb-lock'>
                      <Lock size={18} color='#fff' />
                    </View>
                  )}
                </View>
                <View className='content-info'>
                  <Text className='content-title'>{c.title || '未命名'}</Text>
                  <Text className='content-meta'>
                    {c.content_type === 'video' ? '视频' : '图文'}
                    {locked ? ' · 订阅后可见' : ''}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}
