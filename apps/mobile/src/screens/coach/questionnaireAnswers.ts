/**
 * 教练查看和编辑学员入营问卷答案，与小程序 coach/students/detail 一致。
 * 答案存在 coach_subscriptions.subscribe_data，题型：tags（多选）、times（每周次数）、option（单选，存下标）、rm（1RM）、text。
 */

export type QuestionnaireItem = Record<string, any> & {
  id?: string
  type?: string
  question?: string
  options?: Array<string | number>
  userSelection?: string | number
  userSelections?: string[]
  userInputs?: Record<string, number | string>
  answer?: string
}

export const DEFAULT_TIMES_OPTIONS = ['1', '2', '3', '4', '5', '6', '7']

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizeQuestionnaireData(data: any): QuestionnaireItem[] {
  if (Array.isArray(data)) return clone(data)
  if (Array.isArray(data?.answers)) {
    return data.answers.map((item: any) => ({
      type: 'text',
      question: String(item?.question || '未命名问卷项'),
      userSelection: String(item?.answer || ''),
    }))
  }
  return []
}

export { mergeQuestionnaireAnswers } from '@coachlink/core/src/questionnaireMerge'

export function questionnaireQuestionText(item: QuestionnaireItem) {
  if (item.question && String(item.question).trim()) return String(item.question)
  if (item.type === 'tags') return '训练目标/项目偏好'
  if (item.type === 'times') return '每周训练次数'
  if (item.type === 'rm') return '基础 1RM 数据'
  return '未命名问卷项'
}

export function questionnaireAnswerText(item: QuestionnaireItem) {
  if (typeof item.answer === 'string' && item.answer.trim()) return item.answer
  if (item.type === 'tags') {
    const selections = Array.isArray(item.userSelections) ? item.userSelections : []
    return selections.length ? selections.join('、') : '未选择'
  }
  if (item.type === 'times') return item.userSelection ? `${item.userSelection} 次/周` : '未填写'
  if (item.type === 'option') {
    const options = Array.isArray(item.options) ? item.options : []
    if (item.userSelection === undefined || item.userSelection === null || item.userSelection === '') return '未填写'
    const selectedIndex = Number(item.userSelection)
    if (Number.isInteger(selectedIndex) && options[selectedIndex] !== undefined) return String(options[selectedIndex])
    return String(item.userSelection)
  }
  if (item.type === 'rm') {
    const entries = Object.entries(item.userInputs || {}).filter(([, value]) => Number(value) > 0)
    return entries.length ? entries.map(([key, value]) => `${key}: ${value}kg`).join('、') : '未填写'
  }
  return item.userSelection !== undefined && item.userSelection !== '' ? String(item.userSelection) : '未填写'
}

export function isOptionSelected(item: QuestionnaireItem, option: string, optionIndex: number) {
  const value = item.userSelection
  if (value === undefined || value === null || value === '') return false
  return Number(value) === optionIndex || String(value) === option
}

export function toggleTagSelection(item: QuestionnaireItem, option: string): QuestionnaireItem {
  const current = Array.isArray(item.userSelections) ? item.userSelections : []
  return { ...item, userSelections: current.includes(option) ? current.filter((value) => value !== option) : [...current, option] }
}

/** 1RM 输入框：服务端已按动作名生成 userInputs，优先用它；只有没有时才退回动作 ID。 */
export function rmInputKeys(item: QuestionnaireItem): string[] {
  const inputKeys = Object.keys(item.userInputs || {})
  if (inputKeys.length > 0) return inputKeys
  return Array.isArray(item.actionIds) ? item.actionIds.map(String) : []
}

/** 保存前把编辑中的 1RM 文本转成数字（编辑时保留原文，否则打不出小数点）。 */
export function finalizeQuestionnaireDraft(items: QuestionnaireItem[]): QuestionnaireItem[] {
  return items.map((item) => {
    if (item.type !== 'rm' || !item.userInputs) return item
    const userInputs = Object.fromEntries(Object.entries(item.userInputs).map(([key, value]) => [key, Number(value) || 0]))
    return { ...item, userInputs }
  })
}

/** 只有平台支付宝支付、且有订单号的订阅可以退款。 */
export function refundableOrderId(student: any): string | null {
  if (student?.payment_method !== 'platform_alipay') return null
  const orderId = student?.last_payment_order_id || student?.order_id
  return orderId ? String(orderId) : null
}
