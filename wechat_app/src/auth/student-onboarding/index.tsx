import { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, Image, Button as TaroButton, Input as TaroInput } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { buildStudentOnboardingUrl, isCoreStudentProfileComplete } from '@/services/studentOnboardingService'
import { NEW_USER_AUDIT_STORAGE_KEY } from '@/utils/newUserAudit'
import { API_BASE_URL } from '@/utils/request'
import WheelPicker from '@/components/WheelPicker'
import { svgToDataUri } from '@/utils/svgToDataUri'
import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import femaleFrontSvgRaw from '@/assets/body-map/femaleFrontSvg'
import femaleBackSvgRaw from '@/assets/body-map/femaleBackSvg'
import './index.scss'

const IS_DEV = process.env.NODE_ENV === 'development'

interface OnboardingFormData {
  nickname: string
  avatarUrl: string
  avatarLocalPath: string
  gender: string
  height: number
  weight: number
  fitnessGoal: string
  fitnessLevel: string
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
  { label: '零基础', desc: '从未系统训练过', value: 'beginner', wifiLevel: 1 },
  { label: '入门', desc: '偶尔锻炼，了解基础动作', value: 'novice', wifiLevel: 2 },
  { label: '进阶', desc: '系统训练 1 年以上', value: 'intermediate', wifiLevel: 3 },
  { label: '高阶', desc: '多年训练，可自主制定计划', value: 'advanced', wifiLevel: 4 },
  { label: '精英 / 职业', desc: '健身教练、运动员或竞技水平', value: 'elite', wifiLevel: 5 }
]

const EQUIPMENT_OPTIONS = [
  '徒手',
  '哑铃',
  '杠铃',
  '拉力器/弹力带',
  '固定器械',
  '壶铃'
]

const DURATION_OPTIONS = [15, 20, 30, 45, 60]
const FITNESS_GOAL_SEPARATOR = '\u3001'

type BodyView = 'front' | 'back'
type BodyGender = 'male' | 'female' | 'unknown'

const MUSCLE_FILL_ORIGIN_STYLE = 'fill:#222222'
const MUSCLE_FILL_HIGHLIGHT_STYLE = 'fill:#CF6D4E'
const BODY_PART_OPTION_ORDER = ['胸部', '背部', '肩部', '大臂', '小臂', '腹部', '臀部', '大腿', '小腿']

function normalizeFitnessGoals(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '').split(/[,\u3001\uff0c]/)
  return Array.from(
    new Set(
      rawValues
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

function formatFitnessGoals(goals: string[]): string {
  return normalizeFitnessGoals(goals).join(FITNESS_GOAL_SEPARATOR)
}

function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const singleLineRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = singleLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  const multiLineRegex = /<g\s*\n?\s*data-name="([^"]+)"\s*\n?\s*category="([^"]+)"/g
  while ((match = multiLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  return map
}

function buildBodyPartOptions(frontSvg: string, backSvg: string) {
  const categories = new Set([
    ...Object.values(parseSvgCategoryMap(frontSvg)),
    ...Object.values(parseSvgCategoryMap(backSvg)),
  ])
  return BODY_PART_OPTION_ORDER
    .filter((cat) => cat !== '关节' && categories.has(cat))
    .map((cat) => ({
      id: cat,
      label: cat,
    }))
}

function highlightSvgParts(
  svg: string,
  selectedParts: string[],
  categoryMap: Record<string, string>
): string {
  let result = svg
  const dataNamesToHighlight = new Set<string>()
  for (const part of selectedParts) {
    for (const [dataName, category] of Object.entries(categoryMap)) {
      if (category === part) {
        dataNamesToHighlight.add(dataName)
      }
    }
  }
  for (const dataName of dataNamesToHighlight) {
    const regex = new RegExp(
      `(<g[^>]*data-name="${dataName}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'g'
    )
    result = result.replace(regex, (_match, open, content, close) => {
      const highlighted = content.replace(
        new RegExp(MUSCLE_FILL_ORIGIN_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        MUSCLE_FILL_HIGHLIGHT_STYLE
      )
      return open + highlighted + close
    })
  }
  return result
}

const DEFAULT_FORM_DATA: OnboardingFormData = {
  nickname: '',
  avatarUrl: '',
  avatarLocalPath: '',
  gender: '',
  height: 170,
  weight: 65,
  fitnessGoal: '',
  fitnessLevel: '',
  equipments: [],
  sessionDuration: 30,
  targetBodyParts: []
}

const STEP_TITLES = [
  { title: '基础信息', desc: '选择你的性别，让我们更了解你。' },
  { title: '身体数据', desc: '选择你的身高和体重，推荐计划会更精准。' },
  { title: '重点部位', desc: '选择你更想关注或改善的身体部位。' },
  { title: '健身目标', desc: '选择你现阶段最想完成的目标，可多选。' },
  { title: '训练水平', desc: '选择你的训练水平，匹配适合难度。' },
  { title: '训练条件', desc: '补充你通常能使用的器械和每次可投入时间。' }
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

const GENERATED_NICKNAME_PATTERNS = [
  /^手机用户_\d{4}$/,
  /^邮箱用户_.+$/,
  /^CoachLink 学员$/,
  /^小白体验用户$/,
]

const getExplicitNickname = (value: unknown) => {
  const nickname = String(value || '').trim()
  if (!nickname) return ''
  if (GENERATED_NICKNAME_PATTERNS.some((pattern) => pattern.test(nickname))) return ''
  return nickname
}

const getPrefillNickname = (profile: any, user: any) => {
  return getExplicitNickname(profile?.nickname) || getExplicitNickname(user?.nickname)
}

const WifiSignalIcon: React.FC<{ level: number; active: boolean }> = ({ level, active }) => {
  const inactiveColor = '#e2e8f0'
  const activeColor = '#CF6D4E'
  const c = active ? activeColor : inactiveColor

  return (
    <View className='wifi-signal'>
      <svg width='48' height='40' viewBox='0 0 48 40'>
        <path d='M 4 36 Q 24 16 44 36' stroke={level >= 5 ? c : inactiveColor} fill='none' strokeWidth='3' strokeLinecap='round'/>
        <path d='M 8 30 Q 24 14 40 30' stroke={level >= 4 ? c : inactiveColor} fill='none' strokeWidth='3' strokeLinecap='round'/>
        <path d='M 12 24 Q 24 12 36 24' stroke={level >= 3 ? c : inactiveColor} fill='none' strokeWidth='3' strokeLinecap='round'/>
        <path d='M 16 18 Q 24 10 32 18' stroke={level >= 2 ? c : inactiveColor} fill='none' strokeWidth='3' strokeLinecap='round'/>
        <path d='M 20 12 Q 24 8 28 12' stroke={level >= 1 ? c : inactiveColor} fill='none' strokeWidth='3' strokeLinecap='round'/>
      </svg>
    </View>
  )
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

  const isAuditMode = (() => {
    if (!IS_DEV) return false
    try {
      const params = Taro.getCurrentInstance().router?.params as any
      return params?.audit === '1'
    } catch (_) {
      return false
    }
  })()

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
      if (isAuditMode) {
        Taro.setStorageSync(NEW_USER_AUDIT_STORAGE_KEY, {
          enabled: true,
          startedAt: new Date().toISOString(),
        })
        setFormData({
          ...DEFAULT_FORM_DATA,
          nickname: '',
          gender: 'unknown',
          fitnessGoal: '增肌',
          fitnessLevel: 'beginner',
        })
        setLoading(false)
        return
      }

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
          nickname: getPrefillNickname(profile, session.user),
          avatarUrl: String(profile?.avatar_url || session.user?.avatar_url || '').trim(),
          avatarLocalPath: '',
          gender: String(profile?.gender || ''),
          height: initHeight,
          weight: initWeight,
          fitnessGoal: String(profile?.fitness_goal || ''),
          fitnessLevel: String(profile?.fitness_level || ''),
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
  }, [isAuditMode, nextUrl])

  const toggleListValue = (value: string) => {
    setFormData((prev) => {
      const nextValues = prev.equipments.includes(value)
        ? prev.equipments.filter((item) => item !== value)
        : [...prev.equipments, value]
      return { ...prev, equipments: nextValues }
    })
  }

  const selectedFitnessGoals = useMemo(
    () => normalizeFitnessGoals(formData.fitnessGoal),
    [formData.fitnessGoal]
  )

  const toggleFitnessGoal = (value: string) => {
    setFormData((prev) => {
      const current = normalizeFitnessGoals(prev.fitnessGoal)
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      return { ...prev, fitnessGoal: formatFitnessGoals(next) }
    })
  }

  const handleChooseAvatar = (event: any) => {
    const avatarUrl = event?.detail?.avatarUrl
    if (!avatarUrl) {
      Taro.showToast({ title: '未选择头像', icon: 'none' })
      return
    }
    setFormData((prev) => ({
      ...prev,
      avatarLocalPath: avatarUrl,
    }))
  }

  const uploadWechatAvatar = async (filePath: string) => {
    const token = authService.getToken()
    if (!token) {
      throw new Error('头像上传需要先完成登录')
    }

    const result = await Taro.uploadFile({
      url: `${API_BASE_URL}/api/upload/avatar`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
    })

    let body: any = result.data
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        body = null
      }
    }

    if (result.statusCode !== 200 || !body?.success || !body?.data?.url) {
      throw new Error(body?.message || '头像上传失败')
    }

    return String(body.data.url)
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
    if (step === 4) {
      if (selectedFitnessGoals.length === 0) {
        Taro.showToast({ title: '请选择健身目标', icon: 'none' })
        return false
      }
      return true
    }
    if (step === 5) {
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

    if (isAuditMode) {
      Taro.showToast({
        title: '体验完成，未写入真实账号',
        icon: 'success'
      })
      setTimeout(() => {
        Taro.reLaunch({ url: nextUrl })
      }, 400)
      return
    }

    setSaving(true)
    try {
      let avatarUrl = formData.avatarUrl.trim() || undefined
      if (formData.avatarLocalPath) {
        avatarUrl = await uploadWechatAvatar(formData.avatarLocalPath)
      }

      const profile = await studentService.updateProfile({
        nickname: formData.nickname.trim(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
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
        nickname: formData.nickname.trim(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })

      try {
        await studentService.submitOnboarding({
          answers: {
            flow_version: 'miniapp_v1_aligned',
            fitness_goals: selectedFitnessGoals,
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

  interface BodyPartsStepProps {
    gender: string
    selectedParts: string[]
    onChange: (parts: string[]) => void
  }

  const BodyPartsStep: React.FC<BodyPartsStepProps> = ({ gender, selectedParts, onChange }) => {
    const [view, setView] = useState<BodyView>('front')

    const effectiveGender = gender === 'female' ? 'female' : 'male'

    const svgRaw = useMemo(() => {
      if (effectiveGender === 'female') {
        return view === 'front' ? femaleFrontSvgRaw : femaleBackSvgRaw
      }
      return view === 'front' ? maleFrontSvgRaw : maleBackSvgRaw
    }, [view, effectiveGender])

    const frontSvgRaw = effectiveGender === 'female' ? femaleFrontSvgRaw : maleFrontSvgRaw
    const backSvgRaw = effectiveGender === 'female' ? femaleBackSvgRaw : maleBackSvgRaw
    const categoryMap = useMemo(() => parseSvgCategoryMap(svgRaw), [svgRaw])
    const options = useMemo(() => buildBodyPartOptions(frontSvgRaw, backSvgRaw), [frontSvgRaw, backSvgRaw])

    const svgDataUri = useMemo(() => {
      const baseSvg = svgRaw
        .replace(/fill:#fff/gi, 'fill:#222222')
        .replace(/fill="#fff"/gi, 'fill="#222222"')
      const highlighted = highlightSvgParts(baseSvg, selectedParts, categoryMap)
      const svgStr = highlighted.replace(
        /<svg\s/,
        '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
      )
      return svgToDataUri(svgStr)
    }, [svgRaw, selectedParts, categoryMap])

    const toggleBodyPart = (id: string) => {
      onChange(
        selectedParts.includes(id)
          ? selectedParts.filter((item) => item !== id)
          : [...selectedParts, id]
      )
    }

    return (
      <View className='step-content body-parts-step'>
        <View className='bp-view-toggle'>
          <View
            className={`bp-view-btn ${view === 'front' ? 'bp-view-btn--active' : ''}`}
            onClick={() => setView('front')}
          >
            <Text className='bp-view-btn-text'>正面</Text>
          </View>
          <View
            className={`bp-view-btn ${view === 'back' ? 'bp-view-btn--active' : ''}`}
            onClick={() => setView('back')}
          >
            <Text className='bp-view-btn-text'>背面</Text>
          </View>
        </View>

        <View className='bp-help-card'>
          <Text className='bp-help-title'>正面 / 背面只是观察角度</Text>
          <Text className='bp-help-desc'>左侧是统一肌群列表。比如胸部主要在正面高亮，背部和臀部主要在背面高亮，切换视图不会清掉你的选择。</Text>
        </View>

        <View className='bp-main'>
          <View className='bp-list'>
            {options.map((m) => {
              const isSelected = selectedParts.includes(m.id)
              return (
                <View
                  key={m.id}
                  className={`bp-muscle-chip ${isSelected ? 'bp-muscle-chip--selected' : ''}`}
                  onClick={() => toggleBodyPart(m.id)}
                >
                  <View className={`bp-check ${isSelected ? 'bp-check--checked' : ''}`}>
                    {isSelected && <Text className='bp-check-icon'>✓</Text>}
                  </View>
                  <Text className={`bp-muscle-label ${isSelected ? 'bp-muscle-label--selected' : ''}`}>{m.label}</Text>
                </View>
              )
            })}
          </View>

          <View className='bp-map-wrap'>
            <Image
              className='bp-map-svg'
              src={svgDataUri}
              mode='aspectFit'
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        </View>

        <View className='bp-count'>
          <Text className='bp-count-text'>已选 {selectedParts.length} 个部位</Text>
        </View>
      </View>
    )
  }

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

  const renderBody = () => {
    const profileAvatarSrc = formData.avatarLocalPath || formData.avatarUrl

    return (
    <View className={`onboarding-content ${step === 1 ? 'onboarding-content--profile-step' : ''}`}>
      {isAuditMode && (
        <View className='audit-mode-banner'>
          <Text className='audit-mode-banner-text'>新用户体验检查：本页不会提交真实资料</Text>
        </View>
      )}
      {renderStepDots()}
      <Text className='onboarding-title'>{stepInfo.title}</Text>
      <Text className='onboarding-desc'>{stepInfo.desc}</Text>

      {step === 1 && (

        <View className='step-content'>
          <View className='profile-setup-card'>
            <Text className='profile-setup-title'>头像和昵称</Text>
            <Text className='profile-setup-desc'>昵称必须由你填写，或点击输入框使用微信昵称建议；系统不会自动生成默认名。</Text>
            <View className='profile-setup-row'>
              <TaroButton
                className='profile-avatar-picker'
                openType='chooseAvatar'
                onChooseAvatar={handleChooseAvatar}
              >
                {profileAvatarSrc ? (
                  <Image className='profile-avatar-preview' src={profileAvatarSrc} mode='aspectFill' />
                ) : (
                  <Text className='profile-avatar-placeholder'>选头像</Text>
                )}
              </TaroButton>
              <View className='profile-nickname-shell'>
                <TaroInput
                  className='profile-nickname-input'
                  type='nickname'
                  value={formData.nickname}
                  placeholder='请输入昵称或使用微信昵称'
                  onInput={(event) => setFormData((prev) => ({
                    ...prev,
                    nickname: String(event.detail.value || ''),
                  }))}
                />
              </View>
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
        <BodyPartsStep
          gender={formData.gender}
          selectedParts={formData.targetBodyParts}
          onChange={(parts) => setFormData((prev) => ({ ...prev, targetBodyParts: parts }))}
        />
      )}

      {step === 4 && (

        <View className='step-content'>
          <View className='option-list'>
            {FITNESS_GOAL_OPTIONS.map((option) => {
              const active = selectedFitnessGoals.includes(option.value)
              return (
                <View
                  key={option.value}
                  className={`option-card ${active ? 'option-card--active' : ''}`}
                  onClick={() => toggleFitnessGoal(option.value)}
                >
                  <View className='option-card-main'>
                    <Text className='option-card-title'>{option.label}</Text>
                    <Text className='option-card-desc'>{option.desc}</Text>
                  </View>
                  <View className={`option-check ${active ? 'option-check--active' : ''}`} />
                </View>
              )
            })}
          </View>
        </View>
      )}

      {step === 5 && (
        <View className='step-content'>
          <View className='option-list'>
            {FITNESS_LEVEL_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`option-card option-card--level ${formData.fitnessLevel === option.value ? 'option-card--active' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, fitnessLevel: option.value }))}
              >
                <WifiSignalIcon
                  level={option.wifiLevel}
                  active={formData.fitnessLevel === option.value}
                />
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

      {step === 6 && (
        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>可用训练器械</Text>
            <View className='tag-grid'>
              {EQUIPMENT_OPTIONS.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${formData.equipments.includes(option) ? 'tag-chip--active' : ''}`}
                  onClick={() => toggleListValue(option)}
                >
                  <Text className='tag-chip-text'>{option}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>每次可投入时间</Text>
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
  }

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
