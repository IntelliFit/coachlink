import React from 'react'
import { WECHAT_COACH_PURCHASE_PAUSED } from '@coachlink/core'
import { View, Text, Image } from '@tarojs/components'
import { Lock } from '@nutui/icons-react-taro'
import { ClButton } from '@/components/ui'
import type { CoachContentRow } from '../types'
import './ContentSection.scss'

interface ContentSectionProps {
  contents: CoachContentRow[]
  total: number
  onItemClick?: (content: CoachContentRow) => void
  /** Posts the coach has published but a guest cannot list (the list API needs login). */
  lockedForGuestCount?: number
  onLogin?: () => void
}

export default function ContentSection({ contents, total, onItemClick, lockedForGuestCount = 0, onLogin }: ContentSectionProps) {
  const guestLocked = contents.length === 0 && lockedForGuestCount > 0
  return (
    <View className='content-card'>
      <View className='section-header'>
        <Text className='section-title'>教学内容</Text>
        <Text className='section-count'>共 {guestLocked ? lockedForGuestCount : total} 条</Text>
      </View>
      <View className='content-list'>
        {guestLocked ? (
          <View className='content-guest'>
            <Text className='content-empty'>登录后查看这 {lockedForGuestCount} 篇专栏</Text>
            {onLogin ? <ClButton variant='secondary' size='md' onClick={onLogin}>登录查看</ClButton> : null}
          </View>
        ) : contents.length === 0 ? (
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
                    {locked ? (WECHAT_COACH_PURCHASE_PAUSED ? ' · 仅现有学员可见' : ' · 订阅后可见') : ''}
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
