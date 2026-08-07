import React from 'react'
import { View, Text } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import { Star, Target, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

interface Rule {
  status?: 'success' | 'warning' | 'error'
  detail: string
}

interface ActivityInfoProps {
  description: string | null
  rules: Rule[]
}

const defaultRules: Rule[] = [
  { status: 'success', detail: '一镜到底，视频禁止任何后期剪辑或调速。' },
  { status: 'success', detail: '起始动作手臂需完全伸直，动作终点下巴必须明显过杠。' },
  { status: 'error', detail: '严禁任何形式的借力动作，如甩腿、踢膝或脚尖蹬地。' },
  { status: 'warning', detail: '负重级别挑战需在视频开头展示负重块实称重量。' }
]

export default function ActivityInfo({ description, rules }: ActivityInfoProps) {
  const displayRules = rules?.length ? rules : defaultRules

  return (
    <>
      <View className="section">
        <View className="section-title">
          <View className="section-title-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Icon component={Star} size={18} color="#f59e0b" />
          </View>
          <Text className="section-title-text">活动介绍 / INTRO</Text>
        </View>
        <Text className="section-body">
          {description || '记录每一次突破，让实力被所有人看见。'}
        </Text>
      </View>

      <View className="section">
        <View className="section-title">
          <View className="section-title-icon" style={{ background: 'rgba(207,109,78,0.14)', color: '#CF6D4E' }}>
            <Icon component={Target} size={18} color="#CF6D4E" />
          </View>
          <Text className="section-title-text">评判标准 / RULES</Text>
        </View>
        <View className="rules-list">
          {displayRules.map((rule, idx) => {
            const dotClass = rule.status === 'success' ? 'success' : rule.status === 'warning' ? 'warning' : 'error'
            return (
              <View key={idx} className="rule-item">
                <View className={`rule-dot ${dotClass}`} />
                <Text className="rule-text">{rule.detail}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </>
  )
}
