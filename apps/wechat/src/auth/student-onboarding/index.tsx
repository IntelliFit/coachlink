import { useEffect, useState, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Image, Input as TaroInput, Button as TaroButton, Form as TaroForm } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { buildStudentOnboardingUrl } from '@/services/studentOnboardingService'
import WheelPicker from '@/components/WheelPicker'
import { svgToDataUri } from '@/utils/svgToDataUri'
import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import femaleFrontSvgRaw from '@/assets/body-map/femaleFrontSvg'
import femaleBackSvgRaw from '@/assets/body-map/femaleBackSvg'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

interface OnboardingFormData {
  avatarUrl: string
  nickname: string
  gender: string
  height: number
  weight: number
  fitnessGoals: string[]
  fitnessLevel: string
  equipments: string[]
  weeklyFrequency: number | null
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
  '单杠',
  '双杠',
  '哑铃',
  '杠铃 / 杠铃片',
  '壶铃',
  '弹力带 / 拉力器',
  '固定器械 / 器械区'
]

const WEEKLY_FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90]

const LEGACY_GOAL_MAP: Record<string, string> = {
  gain_muscle: '增肌',
  lose_weight: '减脂',
  improve_fitness: '体能改善',
  rehabilitation: '运动恢复',
  maintain_health: '综合体适能'
}

function normalizeFitnessGoal(value: any) {
  const raw = String(value || '').trim()
  return LEGACY_GOAL_MAP[raw] || raw
}

function normalizeFitnessGoals(value: any, fallback?: any) {
  const source = Array.isArray(value) ? value : (fallback ? [fallback] : [])
  const validValues = new Set(FITNESS_GOAL_OPTIONS.map((item) => item.value))
  return Array.from(new Set(
    source
      .map(normalizeFitnessGoal)
      .filter((item) => item && validValues.has(item))
  )).slice(0, 3)
}

function deriveLegacyInterestTags(goals: string[]) {
  const map: Record<string, string> = {
    减脂: '减脂燃脂',
    体态矫正: '体态纠正',
    灵活柔韧: '灵活性',
    力量提升: '力量举',
    体能改善: '心肺有氧'
  }
  return goals.map((goal) => map[goal]).filter(Boolean)
}

type BodyView = 'front' | 'back'
type BodyGender = 'male' | 'female' | 'unknown'

const MUSCLE_FILL_ORIGIN_STYLE = 'fill:#222222'
const MUSCLE_FILL_HIGHLIGHT_STYLE = 'fill:#CF6D4E'

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
  avatarUrl: '',
  nickname: '',
  gender: '',
  height: 170,
  weight: 65,
  fitnessGoals: [],
  fitnessLevel: '',
  equipments: [],
  weeklyFrequency: null,
  sessionDuration: 30,
  targetBodyParts: []
}

const STEP_TITLES = [
  { title: '基础信息', desc: '头像可选，昵称和性别用于完善你的训练档案。' },
  { title: '身体数据', desc: '选择你的身高和体重，推荐计划会更精准。' },
  { title: '训练目标', desc: '目标可多选，第一项会作为主目标。' },
  { title: '重点部位', desc: '选择你重点练或容易不舒服的部位，可跳过。' },
  { title: '训练条件', desc: '选择你的训练频率、器械和单次训练时长。' }
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

function normalizeOnboardingNickname(value: any) {
  const nickname = String(value || '').trim()
  if (!nickname) return ''

  const generatedPatterns = [
    /^手机用户_\d{4}$/,
    /^邮箱用户_.+$/,
    /^微信用户_.+$/,
    /^CoachLink\s*学员$/,
    /^用户\s*\d{4}$/,
    /^鎵嬫満鐢ㄦ埛_\d{4}$/,
    /^閭鐢ㄦ埛_.+$/,
    /^寰俊鐢ㄦ埛_.+$/,
    /^CoachLink\s*瀛﹀憳$/,
  ]

  return generatedPatterns.some((pattern) => pattern.test(nickname)) ? '' : nickname
}

function hashSeed(input: string) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

const COMMUNITY_NICKNAME_PREFIXES = [
  '晨练记录员',
  '深蹲练习生',
  '街健探索者',
  '训练合伙人',
  '力量观察员',
  '动作打磨者',
  '热身研究员',
  '计划执行者'
]

const DEFAULT_AVATAR_PALETTES = [
  { bg: '#F7EDE7', primary: '#CF6D4E', secondary: '#334155', accent: '#F2B880' },
  { bg: '#EAF4F1', primary: '#2F7D68', secondary: '#0F172A', accent: '#9AD6C5' },
  { bg: '#F3F0FF', primary: '#6D5BD0', secondary: '#1E293B', accent: '#B7A7FF' },
  { bg: '#EEF6FF', primary: '#2563A8', secondary: '#172554', accent: '#93C5FD' },
  { bg: '#FFF7E8', primary: '#B45309', secondary: '#1F2937', accent: '#FCD34D' }
]

function buildGeneratedAvatar(seed: number) {
  const palette = DEFAULT_AVATAR_PALETTES[seed % DEFAULT_AVATAR_PALETTES.length]
  const rotate = (seed % 28) - 14
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="48" fill="${palette.bg}"/>
  <circle cx="122" cy="34" r="28" fill="${palette.accent}" opacity="0.45"/>
  <circle cx="34" cy="132" r="36" fill="${palette.primary}" opacity="0.12"/>
  <g transform="rotate(${rotate} 80 80)">
    <path d="M40 104c12-28 28-42 48-42 18 0 31 10 38 30" fill="none" stroke="${palette.secondary}" stroke-width="10" stroke-linecap="round"/>
    <path d="M50 96h60" fill="none" stroke="${palette.primary}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="64" cy="68" r="12" fill="${palette.primary}"/>
    <circle cx="104" cy="68" r="12" fill="${palette.primary}"/>
  </g>
  <path d="M50 124c16 10 44 10 60 0" fill="none" stroke="${palette.secondary}" stroke-width="7" stroke-linecap="round" opacity="0.78"/>
</svg>`
  return svgToDataUri(svg)
}

function buildDefaultCommunityIdentity(userId?: string | null) {
  const seed = hashSeed(userId || `coachlink-${Date.now()}`)
  const prefix = COMMUNITY_NICKNAME_PREFIXES[seed % COMMUNITY_NICKNAME_PREFIXES.length]
  const suffix = String(seed % 10000).padStart(4, '0')
  return {
    nickname: `${prefix}${suffix}`,
    avatarUrl: buildGeneratedAvatar(seed)
  }
}

function isGeneratedCommunityAvatar(value?: string | null) {
  return String(value || '').startsWith('data:image/svg+xml')
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
  const { effectiveTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_FORM_DATA)
  const [nicknameInputFocused, setNicknameInputFocused] = useState(false)
  const nicknameValueRef = useRef(DEFAULT_FORM_DATA.nickname)
  const nicknameFooterTimerRef = useRef<any>(null)
  const routerParams = (Taro.getCurrentInstance().router?.params as any) || {}
  const isEditMode = String(routerParams.mode || '').trim() === 'edit'

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

  useEffect(() => {
    nicknameValueRef.current = formData.nickname
  }, [formData.nickname])

  useEffect(() => {
    return () => {
      if (nicknameFooterTimerRef.current) {
        clearTimeout(nicknameFooterTimerRef.current)
      }
    }
  }, [])

  const nextUrl = (() => {
    try {
      const rawNext = routerParams?.next
      if (rawNext && typeof rawNext === 'string') {
        const decoded = decodeURIComponent(rawNext)
        if (decoded.startsWith('/') && !decoded.startsWith('/auth/student-onboarding')) {
          return decoded
        }
      }
    } catch (_) {}
    return isEditMode ? '/me/profile/index' : '/pages/index/index'
  })()

  useEffect(() => {
    const bootstrap = async () => {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.userId) {
        const returnTo = isEditMode
          ? `/auth/student-onboarding?mode=edit&next=${encodeURIComponent(nextUrl)}`
          : buildStudentOnboardingUrl(nextUrl)
        Taro.redirectTo({
          url: authService.buildLoginUrl(returnTo)
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

        if (!isEditMode && profile?.onboarding_completed === true) {
          Taro.reLaunch({ url: nextUrl })
          return
        }

        const initHeight = Number(profile?.height || DEFAULT_FORM_DATA.height)
        const initWeight = Number(profile?.weight || DEFAULT_FORM_DATA.weight)
        const generatedIdentity = buildDefaultCommunityIdentity(session.userId)
        const normalizedNickname = normalizeOnboardingNickname(profile?.nickname)
        const existingAvatarUrl = String(profile?.avatar_url || '').trim()

        setFormData({
          avatarUrl: isEditMode ? existingAvatarUrl : (existingAvatarUrl || generatedIdentity.avatarUrl),
          nickname: isEditMode ? String(profile?.nickname || '').trim() : (normalizedNickname || generatedIdentity.nickname),
          gender: String(profile?.gender || ''),
          height: initHeight,
          weight: initWeight,
          fitnessGoals: normalizeFitnessGoals(questionnaire?.fitness_goals, profile?.fitness_goal),
          fitnessLevel: String(profile?.fitness_level || ''),
          equipments: Array.isArray(questionnaire?.equipment) ? questionnaire.equipment : [],
          weeklyFrequency: Number(questionnaire?.weekly_frequency || 0) || null,
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
  }, [isEditMode, nextUrl])

  const toggleListValue = (key: 'fitnessGoals' | 'equipments', value: string) => {
    setFormData((prev) => {
      if (key === 'fitnessGoals' && !prev.fitnessGoals.includes(value) && prev.fitnessGoals.length >= 3) {
        Taro.showToast({ title: '健身目标最多选择 3 个', icon: 'none' })
        return prev
      }
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]
      return { ...prev, [key]: nextValues }
    })
  }

  const handleChooseAvatar = async (e: any) => {
    const avatarFilePath = String(e?.detail?.avatarUrl || '').trim()
    if (!avatarFilePath) {
      return
    }

    setAvatarUploading(true)
    try {
      const uploadedUrl = await studentService.uploadAvatar(avatarFilePath)
      setFormData((prev) => ({ ...prev, avatarUrl: uploadedUrl }))
      Taro.showToast({
        title: '头像已更新',
        icon: 'success'
      })
    } catch (error: any) {
      console.error('[student-onboarding] avatar upload failed:', error)
      Taro.showToast({
        title: error?.message || '头像上传失败',
        icon: 'none'
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  const syncNicknameValue = (rawValue: any, options: { allowEmpty?: boolean } = {}) => {
    if (typeof rawValue !== 'string') {
      return nicknameValueRef.current
    }

    const value = rawValue.trim()
    if (!value && options.allowEmpty === false) {
      return nicknameValueRef.current
    }

    nicknameValueRef.current = value
    setFormData((prev) => {
      if (prev.nickname === value) return prev
      return { ...prev, nickname: value }
    })
    return value
  }

  const syncNicknameFromEvent = (e: any, options: { allowEmpty?: boolean } = {}) => {
    return syncNicknameValue(e?.detail?.value, options)
  }

  const handleNicknameFocus = () => {
    if (nicknameFooterTimerRef.current) {
      clearTimeout(nicknameFooterTimerRef.current)
      nicknameFooterTimerRef.current = null
    }
    setNicknameInputFocused(true)
  }

  const syncNicknameFromNativeNode = (afterSync?: () => void) => {
    const queryFactory = (Taro as any).createSelectorQuery
    if (typeof queryFactory !== 'function') {
      afterSync?.()
      return
    }

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      afterSync?.()
    }

    try {
      queryFactory()
        .select('#student-onboarding-nickname-input')
        .fields({ properties: ['value'] }, (res: any) => {
          syncNicknameValue(res?.value, { allowEmpty: false })
          finish()
        })
        .exec()

      setTimeout(finish, 180)
    } catch (error) {
      console.warn('[student-onboarding] read native nickname input failed:', error)
      finish()
    }
  }

  const restoreFooterAfterNicknamePicker = () => {
    if (nicknameFooterTimerRef.current) {
      clearTimeout(nicknameFooterTimerRef.current)
    }
    nicknameFooterTimerRef.current = setTimeout(() => {
      syncNicknameFromNativeNode(() => {
        setNicknameInputFocused(false)
        nicknameFooterTimerRef.current = null
      })
    }, 320)
  }

  const validateCurrentStep = (override: Partial<OnboardingFormData> = {}) => {
    const current = { ...formData, ...override }
    if (step === 1) {
      if (!current.nickname.trim()) {
        Taro.showToast({ title: '请先填写昵称', icon: 'none' })
        return false
      }
      if (current.nickname.trim().length > 24) {
        Taro.showToast({ title: '昵称最多 24 个字', icon: 'none' })
        return false
      }
      if (!current.gender) {
        Taro.showToast({ title: '请选择性别', icon: 'none' })
        return false
      }
      return true
    }
    if (step === 3) {
      if (formData.fitnessGoals.length === 0) {
        Taro.showToast({ title: '请选择健身目标', icon: 'none' })
        return false
      }
      if (!formData.fitnessLevel) {
        Taro.showToast({ title: '请选择训练水平', icon: 'none' })
        return false
      }
      return true
    }
    if (step === 5) {
      if (!formData.weeklyFrequency) {
        Taro.showToast({ title: '请选择每周可训练频率', icon: 'none' })
        return false
      }
      return true
    }
    return true
  }

  const handleNext = (override: Partial<OnboardingFormData> = {}) => {
    if (loading) return
    if (!validateCurrentStep(override)) return
    if (step === 2) {
      setFormData((prev) => ({ ...prev, height: selectedHeight, weight: selectedWeight }))
    }
    setStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handleStepOneSubmit = (e: any) => {
    syncNicknameValue(e?.detail?.value?.nickname, { allowEmpty: false })
    syncNicknameFromNativeNode(() => {
      handleNext({ nickname: nicknameValueRef.current })
    })
  }

  const handlePrev = () => {
    if (loading) return
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const validateMinimumProfile = () => {
    const nickname = nicknameValueRef.current.trim() || formData.nickname.trim()
    if (!nickname) {
      Taro.showToast({ title: '请先填写昵称', icon: 'none' })
      return false
    }
    if (nickname.length > 24) {
      Taro.showToast({ title: '昵称最多 24 个字', icon: 'none' })
      return false
    }
    if (!formData.gender) {
      Taro.showToast({ title: '请先选择性别', icon: 'none' })
      return false
    }
    return true
  }

  const handleSkip = async () => {
    if (!validateMinimumProfile()) return

    setSaving(true)
    try {
      const nickname = nicknameValueRef.current.trim() || formData.nickname.trim()
      const persistedAvatarUrl = isGeneratedCommunityAvatar(formData.avatarUrl)
        ? null
        : (formData.avatarUrl || null)
      const profilePayload: Record<string, any> = {
        nickname,
        avatar_url: persistedAvatarUrl,
        gender: formData.gender,
        onboarding_completed: true
      }

      if (step >= 2) {
        profilePayload.height = selectedHeight
        profilePayload.weight = selectedWeight
      }
      if (formData.fitnessGoals[0]) profilePayload.fitness_goal = formData.fitnessGoals[0]
      if (formData.fitnessLevel) profilePayload.fitness_level = formData.fitnessLevel

      const profile = await studentService.updateProfile(profilePayload, { showErrorToast: false })
      if (!profile) throw new Error('基础档案保存失败')

      authService.mergeCurrentUser({
        nickname,
        avatar_url: persistedAvatarUrl
      })

      const answers: Record<string, any> = {
        flow_version: 'registration_unified_v2'
      }
      if (formData.fitnessGoals.length) {
        answers.fitness_goals = formData.fitnessGoals
        answers.interest_tags = deriveLegacyInterestTags(formData.fitnessGoals)
      }
      if (formData.targetBodyParts.length) answers.target_body_parts = formData.targetBodyParts
      if (formData.equipments.length) answers.equipment = formData.equipments
      if (formData.weeklyFrequency) {
        answers.weekly_frequency = formData.weeklyFrequency
        answers.session_duration = formData.sessionDuration
      }

      if (Object.keys(answers).length > 1) {
        try {
          await studentService.submitOnboarding({
            answers,
            baseline_video_urls: []
          }, { showErrorToast: false })
        } catch (questionnaireError) {
          console.warn('[student-onboarding] partial questionnaire save failed:', questionnaireError)
        }
      }

      Taro.showToast({
        title: '基础信息已保存，其余资料可稍后补充',
        icon: 'none',
        duration: 2400
      })
      setTimeout(() => {
        Taro.reLaunch({ url: nextUrl })
      }, 400)
    } catch (error: any) {
      console.error('[student-onboarding] skip failed:', error)
      Taro.showToast({
        title: error?.message || '保存失败',
        icon: 'none'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return

    setSaving(true)
    try {
      const primaryGoal = formData.fitnessGoals[0] || ''
      const persistedAvatarUrl = isGeneratedCommunityAvatar(formData.avatarUrl)
        ? null
        : (formData.avatarUrl || null)
      const profile = await studentService.updateProfile(
        {
          nickname: formData.nickname.trim(),
          avatar_url: persistedAvatarUrl,
          gender: formData.gender,
          height: formData.height,
          weight: formData.weight,
          fitness_goal: primaryGoal,
          fitness_level: formData.fitnessLevel,
          onboarding_completed: true
        },
        { showErrorToast: false }
      )

      if (!profile) {
        throw new Error('基础档案保存失败')
      }

      authService.mergeCurrentUser({
        nickname: formData.nickname.trim(),
        avatar_url: persistedAvatarUrl
      })

      let questionnaireSaved = false
      try {
        questionnaireSaved = Boolean(await studentService.submitOnboarding({
          answers: {
            flow_version: 'registration_unified_v2',
            fitness_goals: formData.fitnessGoals,
            interest_tags: deriveLegacyInterestTags(formData.fitnessGoals),
            equipment: formData.equipments,
            weekly_frequency: formData.weeklyFrequency,
            session_duration: formData.sessionDuration,
            target_body_parts: formData.targetBodyParts
          },
          baseline_video_urls: []
        }, { showErrorToast: false }))
      } catch (questionnaireError) {
        console.warn('[student-onboarding] submit questionnaire failed:', questionnaireError)
      }

      Taro.showToast({
        title: questionnaireSaved
          ? (isEditMode ? '档案已更新' : '档案已完善')
          : '档案已保存，训练偏好可稍后补充',
        icon: questionnaireSaved ? 'success' : 'none',
        duration: questionnaireSaved ? 1500 : 2500
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

    const categoryMap = useMemo(() => parseSvgCategoryMap(svgRaw), [svgRaw])

    const options = useMemo(() => {
      const categories = Array.from(new Set(Object.values(categoryMap)))
        .filter((cat) => cat !== '关节')
      return categories.map((cat) => ({
        id: cat,
        label: cat,
      }))
    }, [categoryMap])

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

  const renderBody = () => (
    <View className='onboarding-content'>
      {renderStepDots()}
      <Text className='onboarding-title'>{stepInfo.title}</Text>
      <Text className='onboarding-desc'>{stepInfo.desc}</Text>

      {step === 1 && (

        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>头像</Text>
            <View className='avatar-picker-card'>
              <View className='avatar-picker-main'>
                {formData.avatarUrl ? (
                  <Image className='avatar-preview' src={formData.avatarUrl} mode='aspectFill' />
                ) : (
                  <View className='avatar-placeholder'>
                    <Text className='avatar-placeholder-text'>头像</Text>
                  </View>
                )}
                <View className='avatar-picker-copy'>
                  <Text className='avatar-picker-title'>默认社区头像</Text>
                  <Text className='avatar-picker-desc'>
                    {avatarUploading ? '正在上传...' : '系统已生成一个训练社区头像；想换成微信头像时点下方按钮即可。'}
                  </Text>
                </View>
              </View>
              <TaroButton
                className='avatar-picker-btn'
                openType='chooseAvatar'
                onChooseAvatar={handleChooseAvatar}
                disabled={avatarUploading || saving}
              >
                <Text className='avatar-picker-btn-text'>{avatarUploading ? '上传中...' : '改用微信头像'}</Text>
              </TaroButton>
            </View>
          </View>

          <View className='field-group'>
            <Text className='field-label'>昵称</Text>
            <View className='input-shell input-shell--native'>
              <TaroInput
                id='student-onboarding-nickname-input'
                className='native-nickname-input'
                name='nickname'
                type='nickname'
                maxlength={24}
                defaultValue={formData.nickname}
                placeholder='点击可改用微信昵称，也可以手动修改'
                onFocus={handleNicknameFocus}
                onInput={(e) => syncNicknameFromEvent(e, { allowEmpty: true })}
                onBlur={(e) => {
                  syncNicknameFromEvent(e, { allowEmpty: false })
                  restoreFooterAfterNicknamePicker()
                }}
                onConfirm={(e) => syncNicknameFromEvent(e, { allowEmpty: false })}
                onNickNameReview={(e) => {
                  const detail = (e as any)?.detail || {}
                  if (typeof detail.value === 'string') {
                    syncNicknameFromEvent(e, { allowEmpty: false })
                  }
                  restoreFooterAfterNicknamePicker()
                }}
              />
            </View>
            <Text className='field-tip'>已为你生成一个社区昵称；点击输入框可选择微信昵称，或直接改成喜欢的名字。</Text>
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

      {step === 4 && (
        <BodyPartsStep
          gender={formData.gender}
          selectedParts={formData.targetBodyParts}
          onChange={(parts) => setFormData((prev) => ({ ...prev, targetBodyParts: parts }))}
        />
      )}

      {step === 3 && (

        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>健身目标（最多 3 个）</Text>
            <Text className='field-tip'>第一项会作为主目标，用于兼容旧资料和计划生成。</Text>
          </View>
          <View className='option-list'>
            {FITNESS_GOAL_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`option-card ${formData.fitnessGoals.includes(option.value) ? 'option-card--active' : ''}`}
                onClick={() => toggleListValue('fitnessGoals', option.value)}
              >
                <View className='option-card-main'>
                  <Text className='option-card-title'>{option.label}</Text>
                  <Text className='option-card-desc'>{option.desc}</Text>
                  {formData.fitnessGoals.includes(option.value) && (
                    <Text className='option-card-desc'>第 {formData.fitnessGoals.indexOf(option.value) + 1} 目标</Text>
                  )}
                </View>
                <View className={`option-check ${formData.fitnessGoals.includes(option.value) ? 'option-check--active' : ''}`} />
              </View>
            ))}
          </View>

          <View className='field-group'>
            <Text className='field-label'>训练水平</Text>
          </View>
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

      {step === 5 && (
        <View className='step-content'>
          <View className='field-group'>
            <Text className='field-label'>每周可训练频率</Text>
            <View className='tag-grid duration-grid'>
              {WEEKLY_FREQUENCY_OPTIONS.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${formData.weeklyFrequency === option ? 'tag-chip--active' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, weeklyFrequency: option }))}
                >
                  <Text className='tag-chip-text'>{option >= 6 ? '6 天及以上' : `${option} 天`}</Text>
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
      <TaroForm className='student-onboarding-form' onSubmit={handleStepOneSubmit}>
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

        <View className={`footer-bar ${nicknameInputFocused ? 'footer-bar--hidden' : ''}`}>
          {!isEditMode && (
            <View
              className={`footer-skip-btn ${(saving || loading) ? 'footer-btn--disabled' : ''}`}
              onClick={(saving || loading) ? undefined : handleSkip}
            >
              <Text className='footer-skip-btn-text'>先使用，稍后补充</Text>
              <Text className='footer-skip-hint'>最少填写昵称和性别即可</Text>
            </View>
          )}
          <View className='footer-actions'>
            <View
              className={`footer-btn footer-btn--prev ${step <= 1 || loading ? 'footer-btn--disabled' : ''}`}
              onClick={step <= 1 || loading ? undefined : handlePrev}
            >
              <Text className='footer-btn-icon iconfont icon-left'></Text>
              <Text className='footer-btn-text'>上一步</Text>
            </View>
            {step < totalSteps ? (
              <TaroButton
                className={`footer-btn footer-btn--next ${loading ? 'footer-btn--disabled' : ''}`}
                formType={step === 1 ? 'submit' : undefined}
                disabled={loading}
                onClick={loading || step === 1 ? undefined : () => handleNext()}
              >
                <Text className='footer-btn-text'>继续完善</Text>
                <Text className='footer-btn-icon iconfont icon-right'></Text>
              </TaroButton>
            ) : (
              <View
                className={`footer-btn footer-btn--next ${(saving || loading) ? 'footer-btn--disabled' : ''}`}
                onClick={(saving || loading) ? undefined : handleSubmit}
              >
                <Text className='footer-btn-text'>{saving ? '保存中...' : isEditMode ? '保存档案' : '保存完整档案'}</Text>
                <Text className='footer-btn-icon'>{'>'}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      </TaroForm>
    </ConfigProvider>
  )
}

export default StudentOnboarding
