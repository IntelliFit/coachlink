/**
 * 首页「快速开练」模板，与小程序 today-training StarterHome + 动作库预筛选一致：
 * 进入即兴训练时公共动作库按部位（或街健）预先筛好，新用户不会看到空列表。
 */

const ACTION_IMAGE_BASE = 'https://cdn-assets.coachlink.fit/action-reference-images/reviewed-library-2026-10-07'

export type QuickStartKey = 'push' | 'pull' | 'legs' | 'street'

export type QuickStartTemplate = {
  key: QuickStartKey
  name: string
  meta: string
  image: string
  /** 力量动作按部位关键词筛；街健按街头健身来源筛 */
  keywords?: string[]
  street?: boolean
}

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  { key: 'push', name: '推 · 胸肩三头', meta: '卧推、臂屈伸、推举', image: `${ACTION_IMAGE_BASE}/barbell-bench-press-88a2268aee53.png`, keywords: ['胸', '胸部', '上胸', '下胸', '卧推', '推胸'] },
  { key: 'pull', name: '拉 · 背和二头', meta: '引体、划船、弯举', image: `${ACTION_IMAGE_BASE}/weighted-pullup-2fd59b72aa5e.png`, keywords: ['背', '背部', '引体', '划船', '下拉'] },
  { key: 'legs', name: '腿 · 臀腿', meta: '深蹲、硬拉、分腿蹲', image: `${ACTION_IMAGE_BASE}/high-bar-squat-f6adaebdf53c.png`, keywords: ['腿', '腿部', '股四头', '腘绳', '深蹲', '硬拉'] },
  { key: 'street', name: '街健 · 徒手', meta: '引体、俯卧撑、双杠', image: `${ACTION_IMAGE_BASE}/parallel-bar-dip-3243b1ac37b4.png`, street: true },
]

const STREET_WORKOUT_COMMON_NAMES = new Set(['跪姿俯卧撑', '平板支撑', '击掌俯卧撑', '反手引体'])

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function searchText(action: any) {
  return [action?.name, action?.detail, action?.type, action?.category, ...asList(action?.positions), ...asList(action?.attrs)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function isStreetWorkoutAction(action: any) {
  return searchText(action).includes('街头健身')
    || String(action?.canonical_action_id || '').startsWith('street_workout_')
    || STREET_WORKOUT_COMMON_NAMES.has(String(action?.name || ''))
}

export function findQuickStartTemplate(key: unknown) {
  return QUICK_START_TEMPLATES.find((template) => template.key === key) || null
}

/** 动作是否属于这个快速开练模板（只看力量动作）。 */
export function matchesQuickStart(action: any, template: QuickStartTemplate | null) {
  if (!template) return true
  const type = String(action?.type || 'STRENGTH').toUpperCase()
  if (type !== 'STRENGTH') return false
  if (template.street) return isStreetWorkoutAction(action)
  if (isStreetWorkoutAction(action)) return false
  const text = searchText(action)
  return (template.keywords || []).some((keyword) => text.includes(keyword.toLowerCase()))
}
