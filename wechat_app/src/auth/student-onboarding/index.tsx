import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider, Input } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { buildStudentOnboardingUrl, isCoreStudentProfileComplete } from '@/services/studentOnboardingService'
import WheelPicker from '@/components/WheelPicker'
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
  targetBodyParts: string[]
}

const GENDER_OPTIONS = [
  { label: '男性', value: 'male' },
  { label: '女性', value: 'female' },
  { label: '暂时不填', value: 'unknown' }
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
  sessionDuration: 30,
  targetBodyParts: []
}

const STEP_TITLES = [
  { title: '基础信息', desc: '选择你的性别，让我们更了解你。' },
  { title: '身体数据', desc: '选择你的身高和体重，推荐计划会更精准。' },
  { title: '健身目标', desc: '选择你的健身目标，定制专属训练方案。' },
  { title: '训练水平', desc: '选择你的训练水平，匹配适合难度。' },
  { title: '训练偏好', desc: '选择你感兴趣的训练方向。' }
]

const HEIGHT_MIN = 100
const HEIGHT_MAX = 250
const WEIGHT_MIN = 30
const WEIGHT_MAX = 200
const WEIGHT_STEP = 0.5

const heightItems = (() => {
  const arr: string[] = []
  for (let h = HEIGHT_MIN; h <= HEIGHT_MAX; h++) {
    arr.push(`${h} cm`)
  }
  return arr
})()

const weightItems = (() => {
  const arr: string[] = []
  for (let w = WEIGHT_MIN; w <= WEIGHT_MAX; w += WEIGHT_STEP) {
    arr.push(`${w.toFixed(1)} kg`)
  }
  return arr
})()

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

  const [heightIndex, setHeightIndex] = useState(() => {
    const idx = DEFAULT_FORM_DATA.height - HEIGHT_MIN
    return Math.max(0, Math.min(idx, heightItems.length - 1))
  })

  const [weightIndex, setWeightIndex] = useState(() => {
    const idx = Math.round((DEFAULT_FORM_DATA.weight - WEIGHT_MIN) / WEIGHT_STEP)
    return Math.max(0, Math.min(idx, weightItems.length - 1))
  })

  const selectedHeight = HEIGHT_MIN + heightIndex
  const selectedWeight = Number((WEIGHT_MIN + weightIndex * WEIGHT_STEP).toFixed(1))

  const totalSteps = STEP_TITLES.length

  const nextUrl = (() => {
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
  })()

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

        const initHeight = Number(profile?.height || DEFAULT_FORM_DATA.height)
        const initWeight = Number(profile?.weight || DEFAULT_FORM_DATA.weight)

        setFormData({
          nickname: String(profile?.nickname || getDefaultNickname(session.user)).trim(),
          gender: String(profile?.gender || ''),
          height: initHeight,
          weight: initWeight,
          fitnessGoal: String(profile?.fitness_goal || ''),
          fitnessLevel: String(profile?.fitness_level || ''),
          interestTags: Array.isArray(questionnaire?.interest_tags) ? questionnaire.interest_tags : [],
          equipments: Array.isArray(questionnaire?.equipment) ? questionnaire.equipment : [],
          sessionDuration: Number(questionnaire?.session_duration || DEFAULT_FORM_DATA.sessionDuration),
          targetBodyParts: Array.isArray(questionnaire?.target_body_parts) ? questionnaire.target_body_parts : []
        })

        setHeightIndex(() => {
          const idx = initHeight - HEIGHT_MIN
          return Math.max(0, Math.min(idx, heightItems.length - 1))
        })
        setWeightIndex(() => {
          const idx = Math.round((initWeight - WEIGHT_MIN) / WEIGHT_STEP)
          return Math.max(0, Math.min(idx, weightItems.length - 1))
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

  const toggleListValue = (key: 'interestTags' | 'equipments', value: string) => {
    setFormData((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]
      return { ...prev, [key]: nextValues }
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
      return true
    }
    if (step === 3) {
      if (!formData.fitnessGoal) {
        Taro.showToast({ title: '请选择健身目标', icon: 'none' })
        return false
      }
      return true
    }
    if (step === 4) {
      if (!formData.fitnessLevel) {
        Taro.showToast({ title: '请选择训练水平', icon: 'none' })
        return false
      }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (loading) return
    if (!validateCurrentStep()) return
    if (step === 2) {
      setFormData((prev) => ({ ...prev, height: selectedHeight, weight: selectedWeight }))
    }
    setStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handlePrev = () => {
    if (loading) return
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const goBodyParts = () => {
    const selected = JSON.stringify(formData.targetBodyParts)
    const gender = formData.gender || 'unknown'
    Taro.navigateTo({
      url: `/auth/body-parts?selected=${encodeURIComponent(selected)}&gender=${encodeURIComponent(gender)}`
    })
  }

  useEffect(() => {
    const onBodyParts = (data: { parts: string[] }) => {
      setFormData((prev) => ({ ...prev, targetBodyParts: data.parts }))
    }
    Taro.eventCenter.on('onboarding:bodyParts', onBodyParts)
    return () => {
      Taro.eventCenter.off('onboarding:bodyParts', onBodyParts)
    }
  }, [])

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
            session_duration: formData.sessionDuration,
            target_body_parts: formData.targetBodyParts
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


  const stepInfo = STEP_TITLES[step - 1]

  const renderStepDots = () => (
    <View className='step-dots'>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          className={`step-dot ${i + 1 === step ? 'step-dot--active' : ''}`}
        />
      ))}
    </View>
  )

  const renderBody = () => (
    <View className='onboarding-content'>
      {renderStepDots()}
      <Text className='onboarding-title'>{stepInfo.title}</Text>
      <Text className='onboarding-desc'>{stepInfo.desc}</Text>

      {step === 1 && (

        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>昵称</Text>
            <View className='input-shell'>
              <Input
                value={formData.nickname}
                placeholder='给自己取个名字吧'
                onChange={(value) => setFormData((prev) => ({ ...prev, nickname: value }))}
              />
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>性别</Text>
            <View className='gender-options'>
              {GENDER_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`gender-card ${formData.gender === option.value ? 'gender-card--active' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, gender: option.value }))}
                >
                  <View className={`gender-dot ${formData.gender === option.value ? 'gender-dot--active' : ''}`} />
                  <Text className='gender-label'>{option.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {step === 2 && (
        <View className='step-content' key='step-body-metrics'>
          <View className='metric-preview'>
            <View className='metric-preview-card'>
              <Text className='metric-preview-label'>身高</Text>
              <Text className='metric-preview-value'>{selectedHeight}</Text>
              <Text className='metric-preview-unit'>cm</Text>
            </View>
            <View className='metric-preview-card'>
              <Text className='metric-preview-label'>体重</Text>
              <Text className='metric-preview-value'>{selectedWeight}</Text>
              <Text className='metric-preview-unit'>kg</Text>
            </View>
          </View>

          <View className='metric-pickers'>
            <View className='metric-picker-col'>
              <Text className='metric-picker-label'>身高</Text>
              <WheelPicker
                key='picker-height'
                items={heightItems}
                selectedIndex={heightIndex}
                onChange={setHeightIndex}
                indicatorStyle='height: 80rpx;'
              />
            </View>
            <View className='metric-picker-divider' />
            <View className='metric-picker-col'>
              <Text className='metric-picker-label'>体重</Text>
              <WheelPicker
                key='picker-weight'
                items={weightItems}
                selectedIndex={weightIndex}
                onChange={setWeightIndex}
                indicatorStyle='height: 80rpx;'
              />
            </View>
          </View>
        </View>
      )}

      {step === 3 && (

        <View className='step-content'>
          <View className='option-list'>
            {FITNESS_GOAL_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`option-card ${formData.fitnessGoal === option.value ? 'option-card--active' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, fitnessGoal: option.value }))}
              >
                <View className='option-card-main'>
                  <Text className='option-card-title'>{option.label}</Text>
                  <Text className='option-card-desc'>{option.desc}</Text>
                </View>
                <View className={`option-check ${formData.fitnessGoal === option.value ? 'option-check--active' : ''}`} />
              </View>
            ))}
          </View>
        </View>
      )}

      {step === 4 && (

        <View className='step-content'>
          <View className='option-list'>
            {FITNESS_LEVEL_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`option-card ${formData.fitnessLevel === option.value ? 'option-card--active' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, fitnessLevel: option.value }))}
              >
                <View className='option-card-main'>
                  <Text className='option-card-title'>{option.label}</Text>
                  <Text className='option-card-desc'>{option.desc}</Text>
                </View>
                <View className={`option-check ${formData.fitnessLevel === option.value ? 'option-check--active' : ''}`} />
              </View>
            ))}
          </View>
        </View>
      )}

      {step === 5 && (

        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>感兴趣的健身部位</Text>
            <View className='body-parts-trigger' onClick={goBodyParts}>
              {formData.targetBodyParts.length === 0 ? (
                <Text className='body-parts-trigger-placeholder'>点击选择目标部位</Text>
              ) : (
                <View className='body-parts-tags'>
                  {formData.targetBodyParts.slice(0, 4).map((part) => (
                    <Text key={part} className='body-parts-tag'>{part}</Text>
                  ))}
                  {formData.targetBodyParts.length > 4 && (
                    <Text className='body-parts-tag'>+{formData.targetBodyParts.length - 4}</Text>
                  )}
                </View>
              )}
              <Text className='body-parts-trigger-arrow'>›</Text>
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>感兴趣的训练方向</Text>
            <View className='tag-grid'>
              {INTEREST_OPTIONS.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${formData.interestTags.includes(option) ? 'tag-chip--active' : ''}`}
                  onClick={() => toggleListValue('interestTags', option)}
                >
                  <Text className='tag-chip-text'>{option}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>常用器械</Text>
            <View className='tag-grid'>
              {EQUIPMENT_OPTIONS.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${formData.equipments.includes(option) ? 'tag-chip--active' : ''}`}
                  onClick={() => toggleListValue('equipments', option)}
                >
                  <Text className='tag-chip-text'>{option}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>单次训练时长</Text>
            <View className='tag-grid duration-grid'>
              {DURATION_OPTIONS.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${formData.sessionDuration === option ? 'tag-chip--active' : ''}`}
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
  )

  return (
    <ConfigProvider locale={zhCN}>
      <View className='student-onboarding-page'>
        {loading ? (
          <View className='content-scroll'>
            <View className='loading-state'>
              <Text className='loading-text'>正在加载您的基础信息...</Text>
            </View>
          </View>
        ) : step === 2 ? (
          <View className='content-scroll'>
            {renderBody()}
          </View>
        ) : (
          <ScrollView scrollY className='content-scroll'>
            {renderBody()}
          </ScrollView>
        )}

        <View className='footer-bar'>
          <View
            className={`footer-btn footer-btn--prev ${step <= 1 || loading ? 'footer-btn--disabled' : ''}`}
            onClick={step <= 1 || loading ? undefined : handlePrev}
          >
            <Text className='footer-btn-icon iconfont icon-left'></Text>
            <Text className='footer-btn-text'>上一步</Text>
          </View>
          {step < totalSteps ? (
            <View
              className={`footer-btn footer-btn--next ${loading ? 'footer-btn--disabled' : ''}`}
              onClick={loading ? undefined : handleNext}
            >
              <Text className='footer-btn-text'>下一步</Text>
              <Text className='footer-btn-icon iconfont icon-right'></Text>
            </View>
          ) : (
            <View
              className={`footer-btn footer-btn--next ${(saving || loading) ? 'footer-btn--disabled' : ''}`}
              onClick={(saving || loading) ? undefined : handleSubmit}
            >
              <Text className='footer-btn-text'>{saving ? '保存中...' : '开始训练'}</Text>
              <Text className='footer-btn-icon'>{'>'}</Text>
            </View>
          )}
        </View>
      </View>
    </ConfigProvider>
  )
}

export default StudentOnboarding
