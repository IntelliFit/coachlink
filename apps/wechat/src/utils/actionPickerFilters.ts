export interface ActionPickerFilterOption {
  key: string
  label: string
  keywords: string[]
}

export const ACTION_PICKER_MUSCLE_FILTERS: ActionPickerFilterOption[] = [
  { key: 'all', label: '全部', keywords: [] },
  { key: 'chest', label: '胸', keywords: ['胸', '胸部', '上胸', '下胸', '卧推', '推胸'] },
  { key: 'back', label: '背', keywords: ['背', '背部', '引体', '划船', '下拉'] },
  { key: 'legs', label: '腿', keywords: ['腿', '腿部', '股四头', '腘绳', '深蹲', '硬拉', '下肢'] },
  { key: 'shoulder', label: '肩', keywords: ['肩', '肩部', '三角肌', '推举'] },
  { key: 'arms', label: '手臂', keywords: ['手臂', '二头', '三头', '肱二头', '肱三头', '弯举', '臂屈伸'] },
  { key: 'core', label: '核心', keywords: ['核心', '腹', '腹部', '腰腹', '平板'] },
  { key: 'glutes', label: '臀部', keywords: ['臀', '臀部', '髋'] },
  { key: 'functional', label: '功能性', keywords: ['功能', '稳定', '灵活', '爆发', '平衡'] }
]

export const ACTION_PICKER_EQUIPMENT_FILTERS: ActionPickerFilterOption[] = [
  { key: 'all', label: '全部器械', keywords: [] },
  { key: 'barbell', label: '杠铃', keywords: ['杠铃'] },
  { key: 'dumbbell', label: '哑铃', keywords: ['哑铃'] },
  { key: 'bodyweight', label: '徒手', keywords: ['徒手', '自重', '俯卧撑', '引体'] },
  { key: 'machine', label: '器械', keywords: ['器械', '固定器械', '史密斯', '坐姿'] },
  { key: 'cable', label: '绳索', keywords: ['绳索', '龙门架', '滑轮'] }
]

function asSearchTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,\s，、]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function getActionPickerSearchText(action: any): string {
  return [
    action?.name,
    action?.action_name,
    action?.detail,
    action?.type,
    action?.equipment,
    action?.category,
    action?.primary_muscle,
    ...asSearchTextList(action?.positions),
    ...asSearchTextList(action?.attrs),
    ...asSearchTextList(action?.target_muscles)
  ].filter(Boolean).join(' ').toLowerCase()
}

export function matchesActionPickerFilter(action: any, filter: ActionPickerFilterOption): boolean {
  if (filter.key === 'all') return true
  const source = getActionPickerSearchText(action)
  return filter.keywords.some((keyword) => source.includes(keyword.toLowerCase()))
}
