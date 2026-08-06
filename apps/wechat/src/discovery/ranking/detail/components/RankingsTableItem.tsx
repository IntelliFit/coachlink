import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { Trophy, Medal, Award, Video } from 'lucide-react'
import type { LeaderboardEntryWithProfile } from '@/types/leaderboard'
import type { LeaderboardFormInput } from '@/types/leaderboard'

interface RankingsTableItemProps {
  entry: LeaderboardEntryWithProfile
  index: number
  rankByField: string
  coreValue: string | number
  uniqueLinks: [string, string][]
  metaData: { name: string; userInput: string | null }[]
}

export default function RankingsTableItem({
  entry,
  index,
  rankByField,
  coreValue,
  uniqueLinks,
  metaData
}: RankingsTableItemProps) {
  const rank = index + 1
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default'

  const getRankIcon = () => {
    if (rank === 1) return <Icon component={Trophy} size={14} color="#f59e0b" />
    if (rank === 2) return <Icon component={Medal} size={14} color="#9ca3af" />
    if (rank === 3) return <Icon component={Award} size={14} color="#ea580c" />
    return null
  }

  const handleVideoClick = (url: string) => {
    Taro.setClipboardData({
      data: url,
      success: () => Taro.showToast({ title: '链接已复制', icon: 'none' })
    })
  }

  const hasVideo = uniqueLinks.length > 0
  const displayName = (entry as any).userProfile?.name || (entry.extra_data as any)?.douyin_nickname || '匿名挑战者'
  const avatar = (entry as any).userProfile?.avatar

  return (
    <View className="entry-card">
      <View className="entry-row">
        <View className="entry-left">
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
            <Text className={`entry-rank ${rankClass}`}>{String(rank).padStart(2, '0')}</Text>
            {getRankIcon()}
          </View>
          <View className="entry-avatar">
            {avatar ? (
              <Image src={avatar} mode="aspectFill" style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ width: '100%', height: '100%', background: '#FBF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 800, color: '#CF6D4E' }}>{displayName.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View className="entry-info">
            <Text className="entry-name">{displayName}</Text>
            <Text className="entry-meta">
              {new Date(entry.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} 提交
            </Text>
          </View>
        </View>
        <View className="entry-score-wrap">
          <Text className="entry-score-label">{rankByField || '最终成绩'}</Text>
          <Text className="entry-score-value">{coreValue}</Text>
        </View>
      </View>
      {(metaData.length > 0 || hasVideo) && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {metaData.map((m, i) => (
            <View key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>{m.name}</Text>
              <Text style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>{m.userInput ?? '--'}</Text>
            </View>
          ))}
          {hasVideo && (
            <View
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(207,109,78,0.12)', borderRadius: 20 }}
              onClick={() => uniqueLinks[0] && handleVideoClick(uniqueLinks[0][0])}
            >
              <Icon component={Video} size={12} color="#CF6D4E" />
              <Text style={{ fontSize: 11, fontWeight: 800, color: '#CF6D4E' }}>点击复制视频链接</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
