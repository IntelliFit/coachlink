import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Target, Check } from '@nutui/icons-react-taro'
import { authService } from '@/services/authService'
import AssessmentForm from './AssessmentForm'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const DOMAINS = [
  {
    key: 'weighted_pullup',
    name: '负重引体',
    description: '专注于引体向上的力量发展，适合想要提升背部和手臂力量的学员',
    difficulty: 'intermediate',
    features: ['自重引体最大次数评估', '1RM负重估算', '肩胛启动技术检查', '6周周期化递进']
  },
  {
    key: 'weighted_dips',
    name: '负重臂屈伸',
    description: '专注于臂屈伸的力量发展，针对胸部和三头肌的专项训练',
    difficulty: 'intermediate',
    features: ['自重臂屈伸最大次数评估', '1RM负重估算', '肩部活动度检查', '6周周期化递进']
  },
  {
    key: 'combo',
    name: '引体+臂屈伸组合',
    description: '平衡发展上肢拉力与推力，全面提升上肢力量',
    difficulty: 'advanced',
    features: ['双重动作能力评估', '推拉力量平衡分析', '4-5周高频训练', '综合力量提升']
  }
]

const DIFFICULTY_MAP = {
  beginner: { label: '初级', color: 'diff-green' },
  intermediate: { label: '中级', color: 'diff-blue' },
  advanced: { label: '高级', color: 'diff-primary' }
}

/**
 * 智能生成计划。需 coachId（从 query 传入），未登录跳登录，无 coachId 跳发现页。
 * 流程：选择训练域 → 填写评估表单（与网页端一致）→ 提交后跳转 waiting 页。
 */
export default function GeneratePlan() {
  const [coachId, setCoachId] = useState<string>('')
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const cid = (params.coachId ?? params.coach_id ?? '') as string
    const token = Taro.getStorageSync('token')
    const user = authService.getCurrentUser()

    if (!token || !user?.id) {
      Taro.redirectTo({
        url: `/auth/login?redirect=${encodeURIComponent('/discovery/generate-plan' + (cid ? '?coachId=' + cid : ''))}`
      })
      return
    }
    if (!cid) {
      Taro.redirectTo({ url: '/discovery/index' })
      return
    }
    setCoachId(cid)
  }, [])

  const handleSelectDomain = (key: string) => {
    setSelectedDomain(key)
  }

  const handleConfirm = () => {
    if (!selectedDomain || !coachId) return
    setShowForm(true)
  }

  const handleAssessmentSubmit = () => {
    Taro.navigateTo({
      url: `/discovery/generate-plan/waiting?coachId=${coachId}&domain=${selectedDomain}`
    })
  }

  const handleBack = () => {
    Taro.navigateBack()
  }

  if (!coachId) {
    return (
      <View className="generate-plan-page">
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  if (showForm && selectedDomain) {
    return (
      <View className="generate-plan-page">
        <AssessmentForm
          coachId={coachId}
          domain={selectedDomain}
          onBack={() => setShowForm(false)}
          onSubmit={handleAssessmentSubmit}
        />
      </View>
    )
  }

  return (
    <View className="generate-plan-page">
      <ScrollView scrollY className="page-scroll">
        <View className="domain-header">
          <View className="header-icon-wrap">
            <View className="header-icon"><Target size={28} /></View>
          </View>
          <Text className="header-title">选择您的训练域</Text>
          <Text className="header-desc">根据您想要重点发展的动作选择相应的训练域</Text>
        </View>

        <View className="domain-list">
          {DOMAINS.map((d) => {
            const diff = DIFFICULTY_MAP[d.difficulty as keyof typeof DIFFICULTY_MAP] || { label: '未知', color: 'diff-default' }
            const isSelected = selectedDomain === d.key
            return (
              <View
                key={d.key}
                className={`domain-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectDomain(d.key)}
              >
                <View className="domain-main">
                  <Text className="domain-name">{d.name}</Text>
                  <View className={`domain-diff ${diff.color}`}>
                    <Text>{diff.label}</Text>
                  </View>
                </View>
                <Text className="domain-desc">{d.description}</Text>
                <View className="domain-features">
                  {d.features.slice(0, 3).map((f, i) => (
                    <View key={i} className="feature-item"><Check size={12} /><Text style={{ marginLeft: 4 }}>{f}</Text></View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>

      </ScrollView>
      <View className="actions">
        <View className="btn secondary" onClick={handleBack}>
          <Text>返回</Text>
        </View>
        <View
          className={`btn primary ${!selectedDomain ? 'disabled' : ''}`}
          onClick={selectedDomain ? handleConfirm : undefined}
        >
          <Text>下一步</Text>
        </View>
      </View>
    </View>
  )
}
