import Taro from '@tarojs/taro'

export type PathStage = 'safe-start' | 'stuck' | 'advanced'

export type PainPointKey =
  | 'injury'
  | 'knowledge'
  | 'nutrition'
  | 'body'
  | 'base'
  | 'time'
  | 'coach'
  | 'consistency'
  | 'plan'
  | 'anxiety'
  | 'gym'
  | 'cost'

export interface StageOption {
  key: PathStage
  label: string
  desc: string
}

export interface PainPointOption {
  key: PainPointKey
  label: string
  desc: string
}

export interface StudentPathDiagnosis {
  stage?: PathStage
  painPoints?: PainPointKey[]
  savedAt?: number
  userId?: string | null
}

export interface PathInfo {
  title: string
  subtitle: string
  focus: string[]
}

export interface PathRecommendation {
  title: string
  desc: string
}

export interface LearningCard {
  key: string
  title: string
  desc: string
  tag: string
  path: string
}

export interface CoachSupportCard {
  key: string
  title: string
  desc: string
  query: string
}

export const STUDENT_PATH_DIAGNOSIS_STORAGE_KEY = 'coachlink_student_path_diagnosis_v1'
const STUDENT_PATH_DIAGNOSIS_USER_KEY_PREFIX = `${STUDENT_PATH_DIAGNOSIS_STORAGE_KEY}:user:`
const STUDENT_PATH_DIAGNOSIS_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000

function normalizeUserId(userId?: string | number | null): string | null {
  const normalized = String(userId || '').trim()
  return normalized || null
}

function getStudentPathDiagnosisStorageKey(userId?: string | number | null): string {
  const normalizedUserId = normalizeUserId(userId)
  return normalizedUserId
    ? `${STUDENT_PATH_DIAGNOSIS_USER_KEY_PREFIX}${encodeURIComponent(normalizedUserId)}`
    : STUDENT_PATH_DIAGNOSIS_STORAGE_KEY
}

function knowledgeSearchPath(query: string): string {
  return `/content/knowledge?q=${encodeURIComponent(query)}`
}

function normalizeDiagnosis(saved: StudentPathDiagnosis, userId?: string | number | null): StudentPathDiagnosis | null {
  const normalizedUserId = normalizeUserId(userId)
  const savedUserId = normalizeUserId(saved.userId)
  if (normalizedUserId && savedUserId && savedUserId !== normalizedUserId) return null

  const savedAt = typeof saved.savedAt === 'number' ? saved.savedAt : undefined
  if (savedAt && Date.now() - savedAt > STUDENT_PATH_DIAGNOSIS_MAX_AGE_MS) return null

  return {
    stage: normalizeStage(saved.stage),
    painPoints: normalizePainPoints(saved.painPoints),
    savedAt,
    userId: normalizedUserId || savedUserId,
  }
}

export const stageOptions: StageOption[] = [
  {
    key: 'safe-start',
    label: '刚开始',
    desc: '0-6 个月，先解决怕、乱和不会开始',
  },
  {
    key: 'stuck',
    label: '练过但卡住',
    desc: '有训练经历，开始在意没效果和计划安排',
  },
  {
    key: 'advanced',
    label: '专项进阶',
    desc: '想突破动作、数据、伤病恢复或周期管理',
  },
]

export const stageCards: Record<PathStage, PathInfo> = {
  'safe-start': {
    title: '零基础安全起步',
    subtitle: '先敢开始，再学会怎么练',
    focus: ['低暴露训练', '动作标准', '饮食三原则'],
  },
  stuck: {
    title: '效果卡住诊断',
    subtitle: '找出没效果的具体原因',
    focus: ['训练容量', '恢复节奏', '饮食执行'],
  },
  advanced: {
    title: '专项进阶',
    subtitle: '把动作、数据和周期接起来',
    focus: ['专项标准', '进阶工具', '教练复盘'],
  },
}

export const painPointOptions: PainPointOption[] = [
  { key: 'injury', label: '疼痛/旧伤', desc: '先判断能不能练，避开高风险动作' },
  { key: 'knowledge', label: '不知道怎么练', desc: '需要可信的唯一答案' },
  { key: 'nutrition', label: '饮食困扰', desc: '吃什么、吃多少、外食怎么处理' },
  { key: 'body', label: '体型/体重焦虑', desc: '想变化，但不知道先抓什么' },
  { key: 'base', label: '基础薄弱', desc: '动作不会、力量弱、怕练错' },
  { key: 'time', label: '时间精力不足', desc: '需要最低有效剂量' },
  { key: 'coach', label: '私教体验顾虑', desc: '怕被推销，也怕教练不靠谱' },
  { key: 'consistency', label: '坚持困难', desc: '需要反馈和保底机制' },
  { key: 'plan', label: '计划迷茫', desc: '不知道一周怎么安排' },
  { key: 'anxiety', label: '心理负担', desc: '害怕被看见、被评价或做错' },
  { key: 'gym', label: '不敢进健身房', desc: '需要低暴露场景和第一次引导' },
  { key: 'cost', label: '预算顾虑', desc: '先用低成本路径验证效果' },
]

export const painPointLabels: Record<PainPointKey, string> = painPointOptions.reduce(
  (acc, item) => {
    acc[item.key] = item.label
    return acc
  },
  {} as Record<PainPointKey, string>
)

export function isPathStage(value: unknown): value is PathStage {
  return value === 'safe-start' || value === 'stuck' || value === 'advanced'
}

export function isPainPointKey(value: unknown): value is PainPointKey {
  return painPointOptions.some((item) => item.key === value)
}

export function normalizeStage(value: unknown, fallback: PathStage = 'safe-start'): PathStage {
  return isPathStage(value) ? value : fallback
}

export function normalizePainPoints(value: unknown, fallback: PainPointKey[] = ['knowledge', 'base']): PainPointKey[] {
  if (!Array.isArray(value)) return fallback
  const valid = value.filter(isPainPointKey)
  return valid.length > 0 ? valid : fallback
}

export function getPainPointLabelList(painPoints: unknown, limit = 3): string[] {
  return normalizePainPoints(painPoints, [])
    .map((key) => painPointLabels[key])
    .filter(Boolean)
    .slice(0, limit)
}

export function loadStudentPathDiagnosis(userId?: string | number | null): StudentPathDiagnosis | null {
  try {
    const scopedKey = getStudentPathDiagnosisStorageKey(userId)
    const saved = Taro.getStorageSync<StudentPathDiagnosis>(scopedKey)
    if (saved && typeof saved === 'object') {
      return normalizeDiagnosis(saved, userId)
    }

    if (scopedKey !== STUDENT_PATH_DIAGNOSIS_STORAGE_KEY) {
      const legacy = Taro.getStorageSync<StudentPathDiagnosis>(STUDENT_PATH_DIAGNOSIS_STORAGE_KEY)
      if (legacy && typeof legacy === 'object') {
        const normalized = normalizeDiagnosis(legacy, userId)
        if (normalized && !normalizeUserId(legacy.userId)) {
          const legacySavedAt = typeof legacy.savedAt === 'number' ? legacy.savedAt : 0
          const recentlySaved = legacySavedAt > 0 && Date.now() - legacySavedAt <= STUDENT_PATH_DIAGNOSIS_MAX_AGE_MS
          return recentlySaved ? normalized : null
        }
        return normalized
      }
    }

    return null
  } catch (error) {
    console.warn('[studentPathDiagnosis] load failed', error)
    return null
  }
}

export function saveStudentPathDiagnosis(diagnosis: StudentPathDiagnosis, userId?: string | number | null): boolean {
  try {
    const normalizedUserId = normalizeUserId(userId ?? diagnosis.userId)
    Taro.setStorageSync(getStudentPathDiagnosisStorageKey(normalizedUserId), {
      stage: normalizeStage(diagnosis.stage),
      painPoints: normalizePainPoints(diagnosis.painPoints),
      savedAt: typeof diagnosis.savedAt === 'number' ? diagnosis.savedAt : Date.now(),
      userId: normalizedUserId,
    })
    return true
  } catch (error) {
    console.warn('[studentPathDiagnosis] save failed', error)
    return false
  }
}

export function getPrimaryBlocker(stage: PathStage, painPoints: PainPointKey[]): PathRecommendation {
  if (painPoints.includes('injury')) {
    return {
      title: '本周先把安全边界讲清楚',
      desc: '有疼痛或旧伤时，不先追求强度。先做训练前自检、退阶动作和必要的专业求助判断。',
    }
  }
  if (painPoints.includes('gym') || painPoints.includes('anxiety')) {
    return {
      title: '本周先降低心理暴露',
      desc: '你不需要一开始就去拥挤健身房表现自己。先在低压力场景完成训练，建立确定感。',
    }
  }
  if (painPoints.includes('nutrition')) {
    return {
      title: '本周训练和饮食一起抓',
      desc: '很多“没效果”不是练得不够狠，而是蛋白质、外食和恢复没有形成稳定规则。',
    }
  }
  if (painPoints.includes('body')) {
    return {
      title: '本周先把体型目标拆成行为',
      desc: '先不盯体重和身材焦虑，改成每周可执行的训练、饮食和记录动作，让变化有迹可循。',
    }
  }
  if (painPoints.includes('cost')) {
    return {
      title: '本周先用低成本路径验证效果',
      desc: '先不急着买课或买装备，用保底训练、简化饮食和免费内容确认自己能开始、能坚持。',
    }
  }
  if (painPoints.includes('plan') || painPoints.includes('knowledge') || painPoints.includes('base')) {
    return {
      title: '本周只给一个明确做法',
      desc: '先不要同时看十种教程。按今日主行动走，把动作标准和原因放在执行旁边。',
    }
  }
  if (stage === 'stuck') {
    return {
      title: '本周先找出停滞原因',
      desc: '记录训练容量、睡眠和饮食执行，再决定是加量、减量、换动作还是找教练复盘。',
    }
  }
  if (stage === 'advanced') {
    return {
      title: '本周把目标拆成可验证节点',
      desc: '专项进阶需要标准、周期和反馈，不再靠单次训练感觉判断有没有进步。',
    }
  }
  return {
    title: '本周先建立起点',
    desc: '先完成两次低压力训练，学会基本动作和饮食原则，再逐步加量。',
  }
}

export function buildWeeklyTasks(stage: PathStage, painPoints: PainPointKey[]): string[] {
  const tasks: string[] = []

  if (painPoints.includes('injury')) {
    tasks.push('每次训练前做肩、腰、膝或手腕疼痛自检')
  }
  if (painPoints.includes('gym') || painPoints.includes('anxiety')) {
    tasks.push('选择家里、宿舍、户外或健身房角落完成一次低暴露训练')
  }
  if (painPoints.includes('nutrition')) {
    tasks.push('每餐先补一个掌心大小的蛋白质来源')
  }
  if (painPoints.includes('body')) {
    tasks.push('把体型目标拆成 1 个训练动作和 1 条饮食规则，不每天盯体重')
  }
  if (painPoints.includes('time')) {
    tasks.push('忙的时候只做 10-20 分钟保底训练，不补偿式加练')
  }
  if (painPoints.includes('consistency')) {
    tasks.push('训练后只记录完成度和身体感受，先建立反馈')
  }
  if (painPoints.includes('plan') || painPoints.includes('knowledge') || painPoints.includes('base')) {
    tasks.push('只跟随今日主行动，不再同时收藏新计划')
  }
  if (painPoints.includes('coach')) {
    tasks.push('先看教练擅长解决的问题，再决定是否咨询')
  }
  if (painPoints.includes('cost')) {
    tasks.push('本周只使用免费路径和现有器械，先验证能否完成 2 次训练')
  }
  if (stage === 'stuck') {
    tasks.push('记录本周每个动作的组数、次数和主观疲劳')
  }
  if (stage === 'advanced') {
    tasks.push('为当前专项选一个可验证标准，不只看体感')
  }

  const defaults = [
    '完成 2 次基础训练',
    '训练前确认没有明显疼痛或不适',
    '第 7 天复盘一次：哪里最卡，下周改什么',
  ]

  return [...tasks, ...defaults].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 3)
}

export function buildLearningCards(stage: PathStage, painPoints: PainPointKey[]): LearningCard[] {
  const cards: LearningCard[] = []

  if (painPoints.includes('injury')) {
    cards.push({
      key: 'safety',
      title: '训练前疼痛自检',
      desc: '先判断哪些动作要退阶、暂停或找专业人士，不用硬扛。',
      tag: '安全',
      path: knowledgeSearchPath('疼痛自检'),
    })
  }
  if (painPoints.includes('gym') || painPoints.includes('anxiety')) {
    cards.push({
      key: 'gym-safe',
      title: '第一次进健身房不尴尬',
      desc: '路线、器械、低暴露训练位和被别人看见时怎么处理。',
      tag: '心理',
      path: '/content/path/index',
    })
  }
  if (painPoints.includes('nutrition')) {
    cards.push({
      key: 'nutrition',
      title: '不用算热量的饮食三原则',
      desc: '先用蛋白质优先、手掌法则和外食选择降低执行难度。',
      tag: '饮食',
      path: knowledgeSearchPath('饮食原则'),
    })
  }
  if (painPoints.includes('body')) {
    cards.push({
      key: 'body-goal',
      title: '体型目标先别只看体重',
      desc: '把减脂、塑形或增肌拆成训练完成度、蛋白质、围度和照片记录，减少焦虑驱动的乱练。',
      tag: '目标',
      path: knowledgeSearchPath('体型目标'),
    })
  }
  if (painPoints.includes('cost')) {
    cards.push({
      key: 'low-cost',
      title: '低成本开始也能有效',
      desc: '先用自重、弹力带或现有器械完成最低有效训练，再决定是否升级教练、装备或会员。',
      tag: '成本',
      path: '/content/path/index',
    })
  }
  if (painPoints.includes('knowledge') || painPoints.includes('base') || painPoints.includes('plan')) {
    cards.push({
      key: 'action-standard',
      title: '今天动作做到什么算合格',
      desc: '只看当前动作标准、常见错误和退阶方式，不刷完整动作库。',
      tag: '动作',
      path: '/training/actions',
    })
  }
  if (stage === 'stuck') {
    cards.push({
      key: 'plateau',
      title: '练了没效果先查这 4 件事',
      desc: '训练容量、动作质量、饮食、睡眠恢复，先定位再改计划。',
      tag: '诊断',
      path: knowledgeSearchPath('没效果'),
    })
  }
  if (stage === 'advanced') {
    cards.push({
      key: 'advanced-standard',
      title: '专项进阶要先统一标准',
      desc: '把动作标准、周期计划和复盘指标接起来，减少无效争论。',
      tag: '进阶',
      path: '/content/path/index',
    })
  }

  const defaults: LearningCard[] = [
    {
      key: 'why-minimum',
      title: '为什么第一周不要练太狠',
      desc: '先建立节奏和动作感，避免酸痛、挫败和补偿式训练。',
      tag: '起步',
      path: '/content/path/index',
    },
    {
      key: 'feedback',
      title: '怎么判断自己有没有进步',
      desc: '先记录完成度、次数和身体感受，不急着追求复杂数据。',
      tag: '反馈',
      path: '/me/training-history/index',
    },
  ]

  return [...cards, ...defaults].filter((item, index, arr) => arr.findIndex((x) => x.key === item.key) === index).slice(0, 3)
}

export function buildCoachSupportCards(stage: PathStage, painPoints: PainPointKey[]): CoachSupportCard[] {
  const cards: CoachSupportCard[] = []

  if (painPoints.includes('gym') || painPoints.includes('anxiety')) {
    cards.push({
      key: 'gym',
      title: '健身房不慌',
      desc: '适合害怕被看见、不会用器械、第一次进健身房不知道怎么开始。',
      query: 'gym',
    })
  }
  if (stage === 'safe-start') {
    cards.push({
      key: 'beginner',
      title: '新手护航',
      desc: '适合怕练错、怕进健身房、想有人把第一步讲清楚。',
      query: 'beginner',
    })
  }
  if (painPoints.includes('knowledge') || painPoints.includes('base') || painPoints.includes('plan')) {
    cards.push({
      key: 'form',
      title: '动作纠错',
      desc: '适合动作不确定、想上传视频让人看要点。',
      query: 'form',
    })
  }
  if (painPoints.includes('injury')) {
    cards.push({
      key: 'recovery',
      title: '恢复友好',
      desc: '适合有疼痛和旧伤，需要动作退阶与安全边界。',
      query: 'recovery',
    })
  }
  if (painPoints.includes('nutrition') || painPoints.includes('body') || stage === 'stuck') {
    cards.push({
      key: 'plateau',
      title: '没效果诊断',
      desc: '适合训练、饮食、恢复混在一起，不知道该改哪里。',
      query: 'plateau',
    })
  }
  if (stage === 'advanced') {
    cards.push({
      key: 'advanced',
      title: '专项进阶',
      desc: '适合有明确动作或数据目标，需要周期化和复盘。',
      query: 'advanced',
    })
  }

  return cards.slice(0, 3)
}
