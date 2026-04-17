import React from 'react'
import { View, Text } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import { MessageSquare } from 'lucide-react'

interface ActivityNoticeProps {
  notice: string | null
}

export default function ActivityNotice({ notice }: ActivityNoticeProps) {
  if (!notice || !notice.trim()) return null

  const lines = notice.trim().split('\n').filter(Boolean)

  return (
    <View className="section">
      <View className="section-title">
        <View className="section-title-icon" style={{ background: 'rgba(244,146,39,0.15)', color: '#f49227' }}>
          <Icon component={MessageSquare} size={18} color="#f49227" />
        </View>
        <Text className="section-title-text">特别说明 / NOTICE</Text>
      </View>
      <View className="section-body">
        {lines.map((line, i) => (
          <Text key={i} style={{ display: 'block', marginTop: i > 0 ? 8 : 0 }}>{line}</Text>
        ))}
      </View>
    </View>
  )
}
