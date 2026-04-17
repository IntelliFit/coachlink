import React from 'react'
import { View, Text } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import { Zap, Calendar, Users, User, ArrowUpRight } from 'lucide-react'

interface LeaderboardHeaderProps {
  title: string
  description: string
  startAt?: string | null
  endAt?: string | null
  recordCount?: number
  ownerName?: string
  needReview?: boolean
  onJoinClick: () => void
}

export default function LeaderboardHeader({
  title,
  description,
  startAt,
  endAt,
  recordCount = 0,
  ownerName = '教链',
  needReview = true,
  onJoinClick
}: LeaderboardHeaderProps) {
  const formatTimeRange = () => {
    if (!startAt && !endAt) return '不限时挑战'
    const start = startAt ? new Date(startAt).toLocaleDateString('zh-CN') : '∞'
    const end = endAt ? new Date(endAt).toLocaleDateString('zh-CN') : '∞'
    return `${start} — ${end}`
  }

  return (
    <View className="detail-header">
      <View className="detail-header-inner">
        <View className="header-badge">
          <Icon component={Zap} size={12} color="currentColor" />
          <Text style={{ marginLeft: 6 }}>Live Ranking</Text>
        </View>
        <Text className="header-title">{title}</Text>
        <Text className="header-desc">{description}</Text>
        <View className="header-meta">
          <View className="meta-item">
            <View className="meta-label">挑战周期</View>
            <View className="meta-value">{formatTimeRange()}</View>
          </View>
          <View className="meta-item">
            <View className="meta-label">参与人数</View>
            <View className="meta-value">{recordCount} 位</View>
          </View>
          <View className="meta-item">
            <View className="meta-label">发起人</View>
            <View className="meta-value">{ownerName}</View>
          </View>
        </View>
        {!needReview && (
          <View className="meta-item" style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>无审核比赛</Text>
          </View>
        )}
        <View className="submit-btn-wrap">
          <View className="submit-btn" onClick={onJoinClick}>
            <Text>提交记录</Text>
            <Icon component={ArrowUpRight} size={18} color="currentColor" />
          </View>
        </View>
      </View>
    </View>
  )
}
