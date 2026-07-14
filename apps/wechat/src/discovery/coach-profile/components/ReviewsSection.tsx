import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Message, Star } from '@nutui/icons-react-taro'
import type { PublicCoachReview } from '../types'
import './ReviewsSection.scss'

interface ReviewsSectionProps {
  reviews: PublicCoachReview[]
  loading: boolean
  loadFailed: boolean
}

function formatReviewDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function ReviewsSection({ reviews, loading, loadFailed }: ReviewsSectionProps) {
  return (
    <View className='reviews-card'>
      <Text className='section-title'>学员评价</Text>
      {loading ? (
        <View className='reviews-empty'>
          <Text className='reviews-empty-text'>评价加载中…</Text>
        </View>
      ) : loadFailed ? (
        <View className='reviews-empty'>
          <View className='reviews-empty-icon'><Message size={40} /></View>
          <Text className='reviews-empty-text'>评价加载失败，请下拉刷新重试</Text>
        </View>
      ) : reviews.length === 0 ? (
        <View className='reviews-empty'>
          <View className='reviews-empty-icon'><Message size={40} /></View>
          <Text className='reviews-empty-text'>暂无学员评价</Text>
        </View>
      ) : (
        <View className='review-list'>
          {reviews.map((review) => (
            <View key={review.id} className='review-item'>
              <View className='review-header'>
                {review.studentAvatarUrl ? (
                  <Image className='review-avatar' src={review.studentAvatarUrl} mode='aspectFill' />
                ) : (
                  <View className='review-avatar review-avatar-placeholder'>
                    <Text>{review.studentName.charAt(0) || '学'}</Text>
                  </View>
                )}
                <View className='review-meta'>
                  <Text className='review-student-name'>{review.studentName}</Text>
                  <Text className='review-date'>{formatReviewDate(review.createdAt)}</Text>
                </View>
                {review.rating !== null && (
                  <View className='review-rating'>
                    <Star size={14} />
                    <Text>{Number(review.rating).toFixed(1)}</Text>
                  </View>
                )}
              </View>
              {review.comment ? <Text className='review-content'>{review.comment}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
