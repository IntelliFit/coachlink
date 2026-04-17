import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { Input, Button, Picker, InputNumber } from '@nutui/nutui-react-taro'
import { Icon } from '@/components/Icon'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import { getEmptySportCards, getTotalWeight, showTotalWeight, typicalActionMaps, type SportCards } from '@/utils/sportsCollections'
import './index.scss'

// 性别选项
const GENDER_OPTIONS = [
  { text: '男', value: 'male' },
  { text: '女', value: 'female' }
]

// 健身目标选项
const FITNESS_GOAL_OPTIONS = [
  { text: '减脂塑形', value: '减脂' },
  { text: '增肌强身', value: '增肌' },
  { text: '力量提升', value: '力量提升' },
  { text: '体能改善', value: '体能改善' }
]

// 健身水平选项
const FITNESS_LEVEL_OPTIONS = [
  { text: '初学者', value: 'beginner' },
  { text: '中级', value: 'intermediate' },
  { text: '高级', value: 'advanced' }
]

// 运动类型配置
const SportTypes = [
  { key: 'powerlifting', label: '力量举', icon: '🏋️', color: '#F28631', bg: 'rgba(242, 134, 49, 0.1)' },
  { key: 'streetlifting', label: '街头力量', icon: '💪', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' },
  { key: 'calisthenics', label: '街头健身', icon: '🤸', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  { key: 'weightlifting', label: '举重', icon: '🏋️', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  { key: 'bodybuilding', label: '健美/形体', icon: '🧍', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
  { key: 'running', label: '跑步', icon: '🏃', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  { key: 'cycling', label: '骑行', icon: '🚴', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)' }
]

function EditProfile() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    nickname: '',
    avatar_url: '',
    age: null as number | null,
    gender: '',
    height: null as number | null,
    weight: null as number | null,
    lifestyle: '',
    fitness_goal: '',
    fitness_level: '',
    sport_cards: getEmptySportCards()
  })

  // 加载用户数据
  useEffect(() => {
    const loadProfile = async () => {
      const authSession = authService.getAuthSession({ normalize: true })
      const user = authSession.user
      if (!authSession.isAuthenticated || !user?.id) {
        // 未登录时直接跳转登录页，不显示「请先登录」提示
        Taro.redirectTo({
          url: authService.buildLoginUrl('/me/profile/edit/index')
        })
        return
      }

      try {
        const profileRes = await studentService.getStudentProfile(user.id)
        if (profileRes?.profile) {
          const profileData = profileRes.profile
          const sportCards = (profileData.sport_cards as SportCards) || getEmptySportCards()
          
          setProfile(profileData)
          setFormData({
            nickname: profileData.nickname || '',
            avatar_url: profileData.avatar_url || '',
            age: profileData.age || null,
            gender: profileData.gender || '',
            height: profileData.height || null,
            weight: profileData.weight || null,
            lifestyle: profileData.lifestyle || '',
            fitness_goal: profileData.fitness_goal || '',
            fitness_level: profileData.fitness_level || '',
            sport_cards: {
              ...getEmptySportCards(),
              ...sportCards
            }
          })
        }
      } catch (error: any) {
        Taro.showToast({ title: error.message || '加载失败', icon: 'none' })
      }
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    try {
      setLoading(true)
      await studentService.updateProfile({
        nickname: formData.nickname,
        avatar_url: formData.avatar_url || null,
        age: formData.age,
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        lifestyle: formData.lifestyle,
        fitness_goal: formData.fitness_goal,
        fitness_level: formData.fitness_level,
        sport_cards: formData.sport_cards
      })
      authService.mergeCurrentUser({
        nickname: formData.nickname || '',
        avatar_url: formData.avatar_url || null
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (error: any) {
      Taro.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      Taro.navigateBack()
    }
  }

  // 切换卡片选择
  const toggleCard = (cardKey: string) => {
    const activeCards = formData.sport_cards.activeCards.includes(cardKey)
      ? formData.sport_cards.activeCards.filter(c => c !== cardKey)
      : [...formData.sport_cards.activeCards, cardKey]
    setFormData({
      ...formData,
      sport_cards: { ...formData.sport_cards, activeCards }
    })
  }

  // 更新卡片数据
  const updateCardData = (cardKey: string, field: string, value: number | null) => {
    setFormData({
      ...formData,
      sport_cards: {
        ...formData.sport_cards,
        [cardKey]: {
          ...(formData.sport_cards[cardKey as keyof SportCards] as any),
          [field]: value
        }
      }
    })
  }

  const stepTitles = ['基本信息', '练习领域', '历史成绩']
  const progress = (step / 3) * 100

  return (
    <ConfigProvider locale={zhCN}>
      <View className="edit-profile-page">
        {/* 进度条 */}
        <View className="progress-section">
          <View className="progress-header">
            <Text className="step-indicator">第 {step} 步 / 共 3 步</Text>
            <Text className="step-title">{stepTitles[step - 1]}</Text>
          </View>
          <View className="progress-bar">
            <View className="progress-fill" style={{ width: `${progress}%` }} />
          </View>
        </View>

        <ScrollView className="page-scroll" scrollY>
          <View className="form-content">
            {/* 步骤1：基本信息 */}
            {step === 1 && (
              <View className="form-section">
                <View className="form-grid full-width">
                  <View className="form-item">
                    <Text className="form-label">显示昵称</Text>
                    <Input
                      value={formData.nickname}
                      onChange={(val) => setFormData({ ...formData, nickname: val })}
                      placeholder="如何称呼您？"
                    />
                  </View>

                  <View className="form-item">
                    <Text className="form-label">头像URL</Text>
                    <Input
                      value={formData.avatar_url}
                      onChange={(val) => setFormData({ ...formData, avatar_url: val })}
                      placeholder="粘贴图片URL"
                    />
                    {formData.avatar_url && (
                      <Image
                        src={formData.avatar_url}
                        mode="aspectFill"
                        style={{ width: '48px', height: '48px', borderRadius: '24px', marginTop: '8px' }}
                      />
                    )}
                  </View>
                </View>

                <View className="form-grid">
                  <View className="form-item">
                    <Text className="form-label">年龄</Text>
                    <InputNumber
                      value={formData.age || 0}
                      min={10}
                      max={100}
                      onChange={(val) => setFormData({ ...formData, age: val as number })}
                    />
                  </View>

                  <View className="form-item">
                    <Text className="form-label">性别</Text>
                    <Picker
                      options={GENDER_OPTIONS}
                      value={formData.gender ? [formData.gender] : []}
                      onConfirm={(options, values) => {
                        setFormData({ ...formData, gender: values[0] as string })
                      }}
                    >
                      {(val) => (
                        <Input
                          value={GENDER_OPTIONS.find(o => o.value === val[0])?.text || '请选择性别'}
                          placeholder="请选择性别"
                          readonly
                        />
                      )}
                    </Picker>
                  </View>

                  <View className="form-item">
                    <Text className="form-label">身高 (cm)</Text>
                    <InputNumber
                      value={formData.height || 0}
                      min={100}
                      max={250}
                      onChange={(val) => setFormData({ ...formData, height: val as number })}
                    />
                  </View>

                  <View className="form-item">
                    <Text className="form-label">体重 (kg)</Text>
                    <InputNumber
                      value={formData.weight || 0}
                      min={30}
                      max={300}
                      precision={1}
                      onChange={(val) => setFormData({ ...formData, weight: val as number })}
                    />
                  </View>

                  <View className="form-item">
                    <Text className="form-label">健身目标</Text>
                    <Picker
                      options={FITNESS_GOAL_OPTIONS}
                      value={formData.fitness_goal ? [formData.fitness_goal] : []}
                      onConfirm={(options, values) => {
                        setFormData({ ...formData, fitness_goal: values[0] as string })
                      }}
                    >
                      {(val) => (
                        <Input
                          value={FITNESS_GOAL_OPTIONS.find(o => o.value === val[0])?.text || '请选择健身目标'}
                          placeholder="请选择健身目标"
                          readonly
                        />
                      )}
                    </Picker>
                  </View>

                  <View className="form-item">
                    <Text className="form-label">当前水平</Text>
                    <Picker
                      options={FITNESS_LEVEL_OPTIONS}
                      value={formData.fitness_level ? [formData.fitness_level] : []}
                      onConfirm={(options, values) => {
                        setFormData({ ...formData, fitness_level: values[0] as string })
                      }}
                    >
                      {(val) => (
                        <Input
                          value={FITNESS_LEVEL_OPTIONS.find(o => o.value === val[0])?.text || '请选择健身水平'}
                          placeholder="请选择健身水平"
                          readonly
                        />
                      )}
                    </Picker>
                  </View>
                </View>

                <View className="form-grid full-width">
                  <View className="form-item">
                    <Text className="form-label">生活作息</Text>
                    <Input
                      value={formData.lifestyle}
                      onChange={(val) => setFormData({ ...formData, lifestyle: val })}
                      placeholder="如：朝九晚五"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* 步骤2：练习领域 */}
            {step === 2 && (
              <View className="form-section sport-cards-section">
                <Text className="section-title">选择您感兴趣或正在练习的领域</Text>
                <View className="sport-grid">
                  {SportTypes.map((sport) => {
                    const isActive = formData.sport_cards.activeCards.includes(sport.key)
                    return (
                      <View
                        key={sport.key}
                        className={`sport-card ${isActive ? 'active' : ''}`}
                        onClick={() => toggleCard(sport.key)}
                      >
                        {isActive && <View className="active-indicator" />}
                        <View className="sport-icon" style={{ background: sport.bg, color: sport.color }}>
                          <Text>{sport.icon}</Text>
                        </View>
                        <Text className="sport-label">{sport.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {/* 步骤3：历史成绩 */}
            {step === 3 && (
              <View className="form-section sport-data-section">
                {formData.sport_cards.activeCards.length === 0 ? (
                  <View className="empty-state">
                    <View className="empty-icon">
                      <Text>📊</Text>
                    </View>
                    <Text className="empty-text">点击上方磁贴以激活资产配置</Text>
                  </View>
                ) : (
                  formData.sport_cards.activeCards.map((cardKey) => {
                    const config = SportTypes.find(c => c.key === cardKey)
                    if (!config) return null

                    const cardData = (formData.sport_cards as any)[cardKey]
                    const fields = Object.keys(cardData || {})

                    return (
                      <View key={cardKey} className="sport-data-card" style={{ borderColor: config.color, background: config.bg }}>
                        <View className="card-header">
                          <View className="card-title-row">
                            <View className="card-icon" style={{ background: config.color, color: '#ffffff' }}>
                              <Text>{config.icon}</Text>
                            </View>
                            <Text className="card-title">{config.label}</Text>
                          </View>
                          {showTotalWeight(cardKey) && (
                            <View className="total-weight">
                              总计: {getTotalWeight(cardKey, cardData)} KG
                            </View>
                          )}
                        </View>

                        <View className="data-grid">
                          {fields.map((field) => {
                            const fieldConfig = typicalActionMaps[field]
                            if (!fieldConfig) return null

                            return (
                              <View key={field} className="data-item">
                                <Text className="data-label">{fieldConfig.nameCn} ({fieldConfig.unit})</Text>
                                <InputNumber
                                  value={cardData[field] || 0}
                                  min={0}
                                  onChange={(val) => updateCardData(cardKey, field, val as number)}
                                  placeholder="0"
                                />
                              </View>
                            )
                          })}
                        </View>
                      </View>
                    )
                  })
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* 底部操作按钮 */}
        <View className="footer-actions">
          <Button
            className="action-button cancel"
            onClick={handleBack}
          >
            {step === 1 ? '取消' : '上一步'}
          </Button>
          {step < 3 ? (
            <Button
              className="action-button primary"
              onClick={handleNext}
            >
              下一步
            </Button>
          ) : (
            <Button
              className="action-button primary"
              onClick={handleSave}
              loading={loading}
            >
              保存
            </Button>
          )}
        </View>
      </View>
    </ConfigProvider>
  )
}

export default EditProfile
