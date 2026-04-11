import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider, Input, InputNumber } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { buildStudentOnboardingUrl, isCoreStudentProfileComplete } from '@/services/studentOnboardingService'
import './index.scss'

interface OnboardingFormData {
  nickname: string
  gender: string
  height: number
  weight: number
  fitnessGoal: string
  fitnessLevel: string
  interestTags: string[]
  equipments: string[]
  sessionDuration: number
}

const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' }
]

const FITNESS_GOAL_OPTIONS = [
  { label: '减脂塑形', desc: '减掉多余脂肪，塑造身体线条', value: '减脂' },
  { label: '增肌强身', desc: '增加肌肉量，提升力量感', value: '增肌' },
  { label: '力量提升', desc: '提升绝对力量和运动表现', value: '力量提升' },
  { label: '体能改善', desc: '增强心肺耐力和整体体能', value: '体能改善' },
  { label: '体态矫正', desc: '改善圆肩驼背、骨盆前倾等', value: '体态矫正' },
  { label: '运动恢复', desc: '从伤病或长期不运动中恢复', value: '运动恢复' },
  { label: '综合体适能', desc: '全面均衡提升身体各项能力', value: '综合体适能' },
  { label: '灵活柔韧', desc: '提高关节活动度和柔韧性', value: '灵活柔韧' }
]

const FITNESS_LEVEL_OPTIONS = [
  { label: '零基础', desc: '从未系统训练过', value: 'beginner' },
  { label: '有一点基础', desc: '偶尔锻炼或练过几个月', value: 'intermediate' },
  { label: '有系统训练经验', desc: '持续训练 1 年以上', value: 'advanced' }
]

const INTEREST_OPTIONS = [
  '上肢',
  '下肢',
  '核心',
  '体态纠正',
  '减脂燃脂',
  '灵活性',
  '力量举',
  '心肺有氧'
]

const EQUIPMENT_OPTIONS = [
  '徒手',
  '哑铃',
  '杠铃',
  '拉力器/弹力带',
  '器械区',
  '壶铃'
]

const DURATION_OPTIONS = [15, 20, 30, 45, 60]

const DEFAULT_FORM_DATA: OnboardingFormData = {
  nickname: '',
  gender: '',
  height: 170,
  weight: 65,
  fitnessGoal: '',
  fitnessLevel: '',
  interestTags: [],
  equipments: [],
  sessionDuration: 30
}

const STEP_LABELS = ['基础信息', '健身目标', '训练偏好']

const getDefaultNickname = (user: any) => {
  const nickname = String(user?.nickname || '').trim()
  if (nickname) return nickname

  const phone = String(user?.phone || '').trim()
  if (phone && phone !== 'null') {
    return `手机用户_${phone.slice(-4)}`
  }

  const email = String(user?.email || '').trim()
  if (email) {
    return `邮箱用户_${(email.split('@')[0] || '').slice(0, 8)}`
  }

  return 'CoachLink 学员'
}

function StudentOnboarding() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_FORM_DATA)

  const nextUrl = useMemo(() => {
    try {
      const rawNext = (Taro.getCurrentInstance().router?.params as any)?.next
      if (rawNext && typeof rawNext === 'string') {
        const decoded = decodeURIComponent(rawNext)
        if (decoded.startsWith('/') && !decoded.startsWith('/auth/student-onboarding')) {
          return decoded
        }
      }
    } catch (_) {}
    return '/training/impromptu-training?from=onboarding'
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.userId) {
        Taro.redirectTo({
          url: authService.buildLoginUrl(buildStudentOnboardingUrl(nextUrl))
        })
        return
      }

      if (session.isCoach && session.primaryRole === 'coach') {
        Taro.reLaunch({ url: nextUrl })
        return
      }

      try {
        const profileRes = await studentService.getStudentProfile(session.userId)
        const profile = profileRes?.profile || null
        const questionnaire = profileRes?.questionnaire?.answers || {}

        if (profile?.onboarding_completed === true && isCoreStudentProfileComplete(profile)) {
          Taro.reLaunch({ url: nextUrl })
          return
        }

        setFormData({
          nickname: String(profile?.nickname || getDefaultNickname(session.user)).trim(),
          gender: String(profile?.gender || ''),
          height: Number(profile?.height || DEFAULT_FORM_DATA.height),
          weight: Number(profile?.weight || DEFAULT_FORM_DATA.weight),
          fitnessGoal: String(profile?.fitness_goal || ''),
          fitnessLevel: String(profile?.fitness_level || ''),
          interestTags: Array.isArray(questionnaire?.interest_tags) ? questionnaire.interest_tags : [],
          equipments: Array.isArray(questionnaire?.equipment) ? questionnaire.equipment : [],
          sessionDuration: Number(questionnaire?.session_duration || DEFAULT_FORM_DATA.sessionDuration)
        })
      } catch (error: any) {
        console.error('[student-onboarding] bootstrap failed:', error)
        Taro.showToast({
          title: error?.message || '资料加载失败',
          icon: 'none'
        })
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
  }, [nextUrl])

  const progress = (step / STEP_LABELS.length) * 100

  const toggleListValue = (key: 'interestTags' | 'equipments', value: string) => {
    setFormData((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]

      return {
        ...prev,
        [key]: nextValues
      }
    })
  }

  const validateCurrentStep = () => {
    if (step === 1) {
      if (!formData.nickname.trim()) {
        Taro.showToast({ title: '请先填写昵称', icon: 'none' })
        return false
      }
      if (!formData.gender) {
        Taro.showToast({ title: '请选择性别', icon: 'none' })
        return false
      }
      if (formData.height < 100 || formData.height > 250) {
        Taro.showToast({ title: '请填写合理身高', icon: 'none' })
        return false
      }
      if (formData.weight < 30 || formData.weight > 200) {
        Taro.showToast({ title: '请填写合理体重', icon: 'none' })
        return false
      }
      return true
    }

    if (step === 2) {
      if (!formData.fitnessGoal) {
        Taro.showToast({ title: '请选择健身目标', icon: 'none' })
        return false
      }
      if (!formData.fitnessLevel) {
        Taro.showToast({ title: '请选择训练水平', icon: 'none' })
        return false
      }
    }

    return true
  }

  const handleNext = () => {
    if (loading) return
    if (!validateCurrentStep()) return
    setStep((prev) => Math.min(prev + 1, STEP_LABELS.length))
  }

  const handlePrev = () => {
    if (loading) return
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return

    setSaving(true)
    try {
      const profile = await studentService.updateProfile({
        nickname: formData.nickname.trim(),
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        fitness_goal: formData.fitnessGoal,
        fitness_level: formData.fitnessLevel,
        onboarding_completed: true
      })

      if (!profile) {
        throw new Error('基础档案保存失败')
      }

      authService.mergeCurrentUser({
        nickname: formData.nickname.trim()
      })

      try {
        await studentService.submitOnboarding({
          answers: {
            flow_version: 'miniapp_v1_aligned',
            interest_tags: formData.interestTags,
            equipment: formData.equipments,
            session_duration: formData.sessionDuration
          },
          baseline_video_urls: []
        })
      } catch (questionnaireError) {
        console.warn('[student-onboarding] submit questionnaire failed:', questionnaireError)
      }

      Taro.showToast({
        title: '档案已完善',
        icon: 'success'
      })

      setTimeout(() => {
        Taro.reLaunch({ url: nextUrl })
      }, 400)
    } catch (error: any) {
      console.error('[student-onboarding] submit failed:', error)
      Taro.showToast({
        title: error?.message || '保存失败',
        icon: 'none'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='student-onboarding-page'>
        <View className='hero-card'>
          <Text className='hero-eyebrow'>首次登录</Text>
          <Text className='hero-title'>完善基础档案</Text>
          <Text className='hero-desc'>先补齐关键信息，后续推荐计划、训练建议和资料同步都会更准确。</Text>
        </View>

        <View className='progress-card'>
          <View className='progress-meta'>
            <Text className='progress-step'>第 {step} 步 / 共 {STEP_LABELS.length} 步</Text>
            <Text className='progress-label'>{STEP_LABELS[step - 1]}</Text>
          </View>
          <View className='progress-track'>
            <View className='progress-fill' style={{ width: `${progress}%` }} />
          </View>
        </View>

        <ScrollView scrollY className='content-scroll'>
          {loading ? (
            <View className='loading-card'>
              <Text className='loading-text'>正在加载您的基础信息...</Text>
            </View>
          ) : (
            <View className='content-card'>
              {step === 1 && (
                <View className='section'>
                  <View className='field'>
                    <Text className='field-label'>昵称</Text>
                    <View className='input-shell'>
                      <Input
                        value={formData.nickname}
                        placeholder='给自己取个名字吧'
                        onChange={(value) => setFormData((prev) => ({ ...prev, nickname: value }))}
                      />
                    </View>
                  </View>

                  <View className='field'>
                    <Text className='field-label'>性别</Text>
                    <View className='chip-grid two-columns'>
                      {GENDER_OPTIONS.map((option) => (
                        <View
                          key={option.value}
                          className={`choice-card ${formData.gender === option.value ? 'choice-card-active' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, gender: option.value }))}
                        >
                          <Text className='choice-title'>{option.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='metric-grid'>
                    <View className='field'>
                      <Text className='field-label'>身高 (cm)</Text>
                      <View className='metric-shell'>
                        <InputNumber
                          value={formData.height}
                          min={100}
                          max={250}
                          onChange={(value) => setFormData((prev) => ({ ...prev, height: Number(value || 0) }))}
                        />
                      </View>
                    </View>

                    <View className='field'>
                      <Text className='field-label'>体重 (kg)</Text>
                      <View className='metric-shell'>
                        <InputNumber
                          value={formData.weight}
                          min={30}
                          max={200}
                          precision={1}
                          onChange={(value) => setFormData((prev) => ({ ...prev, weight: Number(value || 0) }))}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {step === 2 && (
                <View className='section'>
                  <View className='field'>
                    <Text className='field-label'>健身目标</Text>
                    <View className='stack-grid'>
                      {FITNESS_GOAL_OPTIONS.map((option) => (
                        <View
                          key={option.value}
                          className={`choice-card choice-card-left ${formData.fitnessGoal === option.value ? 'choice-card-active' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, fitnessGoal: option.value }))}
                        >
                          <Text className='choice-title'>{option.label}</Text>
                          <Text className='choice-desc'>{option.desc}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='field'>
                    <Text className='field-label'>训练水平</Text>
                    <View className='stack-grid'>
                      {FITNESS_LEVEL_OPTIONS.map((option) => (
                        <View
                          key={option.value}
                          className={`choice-card choice-card-left ${formData.fitnessLevel === option.value ? 'choice-card-active' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, fitnessLevel: option.value }))}
                        >
                          <Text className='choice-title'>{option.label}</Text>
                          <Text className='choice-desc'>{option.desc}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {step === 3 && (
                <View className='section'>
                  <View className='field'>
                    <Text className='field-label'>感兴趣的训练方向</Text>
                    <View className='chip-grid'>
                      {INTEREST_OPTIONS.map((option) => (
                        <View
                          key={option}
                          className={`tag-chip ${formData.interestTags.includes(option) ? 'tag-chip-active' : ''}`}
                          onClick={() => toggleListValue('interestTags', option)}
                        >
                          <Text className='tag-chip-text'>{option}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='field'>
                    <Text className='field-label'>常用器械</Text>
                    <View className='chip-grid'>
                      {EQUIPMENT_OPTIONS.map((option) => (
                        <View
                          key={option}
                          className={`tag-chip ${formData.equipments.includes(option) ? 'tag-chip-active' : ''}`}
                          onClick={() => toggleListValue('equipments', option)}
                        >
                          <Text className='tag-chip-text'>{option}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View className='field'>
                    <Text className='field-label'>单次训练时长</Text>
                    <View className='chip-grid duration-grid'>
                      {DURATION_OPTIONS.map((option) => (
                        <View
                          key={option}
                          className={`tag-chip ${formData.sessionDuration === option ? 'tag-chip-active' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, sessionDuration: option }))}
                        >
                          <Text className='tag-chip-text'>{option} 分钟</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View className='footer-bar'>
          {step > 1 ? (
            <View className={`footer-btn footer-btn-secondary ${loading ? 'footer-btn-disabled' : ''}`} onClick={loading ? undefined : handlePrev}>
              <Text className='footer-btn-text footer-btn-text-secondary'>上一步</Text>
            </View>
          ) : (
            <View className='footer-btn footer-btn-placeholder' />
          )}

          {step < STEP_LABELS.length ? (
            <View className={`footer-btn footer-btn-primary ${loading ? 'footer-btn-disabled' : ''}`} onClick={loading ? undefined : handleNext}>
              <Text className='footer-btn-text'>下一步</Text>
            </View>
          ) : (
            <View className={`footer-btn footer-btn-primary ${(saving || loading) ? 'footer-btn-disabled' : ''}`} onClick={(saving || loading) ? undefined : handleSubmit}>
              <Text className='footer-btn-text'>{saving ? '保存中...' : '开始训练'}</Text>
            </View>
          )}
        </View>
      </View>
    </ConfigProvider>
  )
}

export default StudentOnboarding
