/**
 * 新用户引导，与小程序 auth/student-onboarding 和 services/studentOnboardingService.ts 一致。
 */

export const GENDER_OPTIONS = [
  { label: '男性', value: 'male' },
  { label: '女性', value: 'female' },
  { label: '暂时不填', value: 'unknown' },
]
export const FITNESS_GOAL_OPTIONS = [
  { label: '减脂塑形', desc: '减掉多余脂肪，塑造身体线条', value: '减脂' },
  { label: '增肌强身', desc: '增加肌肉量，提升力量感', value: '增肌' },
  { label: '力量提升', desc: '提升绝对力量和运动表现', value: '力量提升' },
  { label: '体能改善', desc: '增强心肺耐力和整体体能', value: '体能改善' },
  { label: '体态矫正', desc: '改善圆肩驼背、骨盆前倾等', value: '体态矫正' },
  { label: '运动恢复', desc: '从伤病或长期不运动中恢复', value: '运动恢复' },
  { label: '综合体适能', desc: '全面均衡提升身体各项能力', value: '综合体适能' },
  { label: '灵活柔韧', desc: '提高关节活动度和柔韧性', value: '灵活柔韧' },
]
export const FITNESS_LEVEL_OPTIONS = [
  { label: '零基础', desc: '从未系统训练过', value: 'beginner' },
  { label: '入门', desc: '偶尔锻炼，了解基础动作', value: 'novice' },
  { label: '进阶', desc: '系统训练 1 年以上', value: 'intermediate' },
  { label: '高阶', desc: '多年训练，可自主制定计划', value: 'advanced' },
  { label: '精英 / 职业', desc: '健身教练、运动员或竞技水平', value: 'elite' },
]
/** 小程序第 4 步是人体图，按肌群类别保存；APP 用同一组类别名做多选。 */
export const BODY_PART_OPTIONS = ['肩部', '胸部', '背部', '腹部', '大臂', '小臂', '臀部', '大腿', '小腿']
export const EQUIPMENT_OPTIONS = ['徒手', '单杠', '双杠', '哑铃', '杠铃 / 杠铃片', '壶铃', '弹力带 / 拉力器', '固定器械 / 器械区']
export const WEEKLY_FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6]
export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90]
export const MAX_GOALS = 3

export const ONBOARDING_STEPS = [
  { title: '基础信息', desc: '头像可选，昵称和性别用于完善你的训练档案。' },
  { title: '身体数据', desc: '填写你的身高和体重，推荐计划会更精准。' },
  { title: '训练目标', desc: '目标可多选，第一项会作为主目标。' },
  { title: '重点部位', desc: '选择你重点练或容易不舒服的部位，可跳过。' },
  { title: '训练条件', desc: '选择你的训练频率、器械和单次训练时长。' },
]

export type OnboardingForm = {
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

export const DEFAULT_ONBOARDING_FORM: OnboardingForm = {
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
  targetBodyParts: [],
}

/** 学员身份且资料里没标记完成引导时，登录后进入引导；教练端和管理员不进。 */
export function requiresStudentOnboarding(profile: any, user: { is_admin?: boolean | null } | null | undefined, appRole: 'student' | 'coach') {
  if (!user || user.is_admin || appRole === 'coach') return false
  if (!profile) return true
  return profile.onboarding_completed !== true
}

/** 每一步的必填校验，返回错误文案；通过返回 null。 */
export function validateOnboardingStep(step: number, form: OnboardingForm): string | null {
  if (step === 1) {
    const nickname = form.nickname.trim()
    if (!nickname) return '请先填写昵称'
    if (Array.from(nickname).length > 24) return '昵称最多 24 个字'
    if (!form.gender) return '请选择性别'
  }
  if (step === 2) {
    // 与小程序选择器范围一致：身高 100–250 cm，体重 30–200 kg（0.5 kg 步进）
    if (!(form.height >= 100 && form.height <= 250)) return '身高请填写 100–250 cm'
    if (!(form.weight >= 30 && form.weight <= 200)) return '体重请填写 30–200 kg'
  }
  if (step === 3) {
    if (form.fitnessGoals.length === 0) return '请选择健身目标'
    if (!form.fitnessLevel) return '请选择训练水平'
  }
  if (step === 5 && !form.weeklyFrequency) return '请选择每周可训练频率'
  return null
}

export function toggleGoal(goals: string[], value: string): { goals: string[]; error?: string } {
  if (goals.includes(value)) return { goals: goals.filter((goal) => goal !== value) }
  if (goals.length >= MAX_GOALS) return { goals, error: `健身目标最多选择 ${MAX_GOALS} 个` }
  return { goals: [...goals, value] }
}

function deriveLegacyInterestTags(goals: string[]) {
  const map: Record<string, string> = { 减脂: '减脂燃脂', 体态矫正: '体态纠正', 灵活柔韧: '灵活性', 力量提升: '力量举', 体能改善: '心肺有氧' }
  return goals.map((goal) => map[goal]).filter(Boolean)
}

/**
 * 提交资料和问卷。complete=true 是走完全部步骤；false 是中途「先这样，稍后补充」：
 * 只带已经填到的步骤（与小程序 handleSkip 一致），并且同样标记 onboarding_completed。
 */
export function buildOnboardingPayloads(form: OnboardingForm, reachedStep: number, complete: boolean) {
  const profile: Record<string, unknown> = {
    nickname: form.nickname.trim(),
    avatar_url: form.avatarUrl || null,
    gender: form.gender,
    onboarding_completed: true,
  }
  if (complete || reachedStep >= 2) {
    profile.height = form.height
    profile.weight = form.weight
  }
  if (form.fitnessGoals[0]) profile.fitness_goal = form.fitnessGoals[0]
  if (form.fitnessLevel) profile.fitness_level = form.fitnessLevel

  const answers: Record<string, unknown> = { flow_version: 'registration_unified_v2' }
  if (complete) {
    Object.assign(answers, {
      fitness_goals: form.fitnessGoals,
      interest_tags: deriveLegacyInterestTags(form.fitnessGoals),
      equipment: form.equipments,
      weekly_frequency: form.weeklyFrequency,
      session_duration: form.sessionDuration,
      target_body_parts: form.targetBodyParts,
    })
  } else {
    if (form.fitnessGoals.length) {
      answers.fitness_goals = form.fitnessGoals
      answers.interest_tags = deriveLegacyInterestTags(form.fitnessGoals)
    }
    if (form.targetBodyParts.length) answers.target_body_parts = form.targetBodyParts
    if (form.equipments.length) answers.equipment = form.equipments
    if (form.weeklyFrequency) {
      answers.weekly_frequency = form.weeklyFrequency
      answers.session_duration = form.sessionDuration
    }
  }
  const questionnaire = complete || Object.keys(answers).length > 1 ? { answers, baseline_video_urls: [] as string[] } : null
  return { profile, questionnaire }
}
