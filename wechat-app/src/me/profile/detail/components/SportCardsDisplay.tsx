import React, { useState, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import { getTotalWeight, showTotalWeight, typicalActionMaps } from '@/utils/sportsCollections'
import type { SportCards } from '@/utils/sportsCollections'
import './SportCardsDisplay.scss'

interface SportCardsDisplayProps {
  sportCards: SportCards | null
}

// 运动类型配置：使用 emoji 替代 lucide-react（小程序兼容性更好）
const SportTypes = [
  { key: 'powerlifting', label: '力量举', emoji: '', color: '#F28631', bg: 'rgba(242, 134, 49, 0.1)' },
  { key: 'streetlifting', label: '街头力量', emoji: '', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' },
  { key: 'calisthenics', label: '街头健身', emoji: '', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  { key: 'weightlifting', label: '举重', emoji: '', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  { key: 'bodybuilding', label: '健美/形体', emoji: '', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
  { key: 'running', label: '跑步', emoji: '', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  { key: 'cycling', label: '骑行', emoji: '', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)' }
]

interface SportChartDisplayProps {
  title: string
  emoji: string
  data: Record<string, any>
  sportKey: string
}

const SportChartDisplay: React.FC<SportChartDisplayProps> = ({
  title,
  emoji,
  data,
  sportKey
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const sportFields = useMemo(() => {
    return Object.entries(typicalActionMaps).filter(([key]) => {
      if (sportKey === 'powerlifting') return ['squat', 'bench', 'deadlift'].includes(key)
      if (sportKey === 'streetlifting') return ['weightedPullup', 'weightedDip', 'weightedMuscleUp', 'squat'].includes(key)
      if (sportKey === 'calisthenics') return ['maxPullups', 'maxDips', 'maxMuscleUps', 'frontLever', 'planche', 'humanFlag'].includes(key)
      if (sportKey === 'weightlifting') return ['snatch', 'cleanAndJerk'].includes(key)
      if (sportKey === 'bodybuilding') return ['bodyfat', 'chest', 'arm', 'waist', 'hip', 'thigh', 'calf'].includes(key)
      if (sportKey === 'running') return ['fiveK', 'tenK', 'halfMarathon', 'marathon'].includes(key)
      if (sportKey === 'cycling') return ['ftp', 'maxPower', 'maxDistance'].includes(key)
      return false
    })
  }, [sportKey])

  // 计算图表数据：获取最大值用于计算百分比
  const chartData = useMemo(() => {
    const values = sportFields.map(([fieldKey]) => {
      const val = data?.[fieldKey]
      return typeof val === 'number' && val > 0 ? val : 0
    })
    const maxValue = Math.max(...values, 1) // 至少为1，避免除零
    return { values, maxValue }
  }, [sportFields, data])

  return (
    <View className={`sport-chart-card ${isExpanded ? 'expanded' : ''}`}>
      {/* 可点击的 Header */}
      <View
        className="sport-chart-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <View className="header-left">
          <View className={`icon-wrapper ${isExpanded ? 'expanded' : ''}`}>
            <Text className="sport-emoji">{emoji}</Text>
          </View>
          <View className="header-text">
            <Text className="header-title">{title}</Text>
            {!isExpanded && (
              <Text className="header-subtitle">点击查看详情数据</Text>
            )}
          </View>
        </View>

        <View className="header-right">
          {showTotalWeight(sportKey) && data && (
            <View className="total-weight-display">
              <Text className={`total-value ${isExpanded ? 'expanded' : ''}`}>
                {getTotalWeight(sportKey, data)}
                <Text className="total-unit">kg</Text>
              </Text>
            </View>
          )}
          <Text className={`chevron-icon ${isExpanded ? 'expanded' : ''}`}>▼</Text>
        </View>
      </View>

      {/* 折叠内容 - 使用 CSS 条形图替代 Chart */}
      <View className={`content-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <View className="content-inner">
          <View className="divider" />
          <View className="chart-container">
            {sportFields.map(([fieldKey, fieldConfig]) => {
              const value = data?.[fieldKey] ?? null
              const numValue = typeof value === 'number' && value > 0 ? value : 0
              const percentage = chartData.maxValue > 0 ? (numValue / chartData.maxValue) * 100 : 0

              return (
                <View key={fieldKey} className="chart-bar-item">
                  <View className="bar-label">
                    <Text className="bar-label-text">{fieldConfig.nameCn}</Text>
                  </View>
                  <View className="bar-wrapper">
                    <View 
                      className="bar-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                  <View className="bar-value">
                    <Text className="bar-value-text">{value ?? '-'}</Text>
                    <Text className="bar-value-unit">{fieldConfig.unit}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

const SportCardsDisplay: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
  if (!sportCards?.activeCards || sportCards.activeCards.length === 0) {
    return null
  }

  const validCards = sportCards.activeCards
    .map((sportKey) => {
      const sportType = SportTypes.find(type => type.key === sportKey)
      if (!sportType) return null

      const sportData = sportCards[sportKey as keyof typeof sportCards]
      if (!sportData || typeof sportData !== 'object') return null

      return {
        sportKey,
        sportType,
        sportData: sportData as Record<string, any>
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (validCards.length === 0) {
    return null
  }

  return (
    <View className="sport-cards-display">
      {validCards.map(({ sportKey, sportType, sportData }) => (
        <SportChartDisplay
          key={sportKey}
          title={sportType.label}
          emoji={sportType.emoji}
          data={sportData}
          sportKey={sportKey}
        />
      ))}
    </View>
  )
}

export default SportCardsDisplay
