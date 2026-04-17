import React from 'react'
import { View, Text } from '@tarojs/components'
import { Message } from '@nutui/icons-react-taro'
import './ReviewsSection.scss'

interface ReviewsSectionProps {
  reviewCount: number
}

export default function ReviewsSection({ reviewCount }: ReviewsSectionProps) {
  return (
    <View className='reviews-card'>
      <Text className='section-title'>学员评价</Text>
      <View className='reviews-empty'>
        <View className='reviews-empty-icon'><Message size={40} /></View>
        <Text className='reviews-empty-text'>
          {reviewCount > 0 ? '暂无评价数据' : '暂无学员评价'}
        </Text>
      </View>
    </View>
  )
}
