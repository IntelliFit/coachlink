/**
 * 小程序计划 AI 助手：解读 Web batch-operation 的 SSE 结果。
 *
 * 一轮对话可能是修改预览、追问（need_clarification）或查询回答（query_result），
 * 三种都要交给页面展示，并带着对话历史进入下一轮。不依赖 Taro，便于单测。
 */

export type AiPlanAssistantTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AiPlanAssistantModification = {
  dayIndex?: number
  actionName?: string
  field?: string
  oldValue?: any
  newValue?: any
}

export type AiPlanAssistantOneRm = {
  actionId: string
  actionName: string
  canonicalActionId?: string | null
  studentActionId?: string | null
  currentOneRM: number
  nextOneRM: number
  deltaKg: number
  reason?: string
}

export type AiPlanAssistantResult =
  | {
    kind: 'preview'
    originalTrainingDays: any[]
    updatedTrainingDays: any[]
    modifications: AiPlanAssistantModification[]
    pendingActions: any[]
    oneRmAdjustments: AiPlanAssistantOneRm[]
    restoredLockedDayIndexes: number[]
    message: string
    assistantMessage: string
  }
  | { kind: 'clarification'; question: string; suggestions: string[] }
  | { kind: 'answer'; answer: string }

export function parseBatchOperationMessages(rawData: any): any[] {
  const text = typeof rawData === 'string'
    ? rawData
    : rawData instanceof ArrayBuffer
      ? String.fromCharCode(...new Uint8Array(rawData))
      : JSON.stringify(rawData || '')

  const messages: any[] = []
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const jsonText = trimmed.replace(/^data:\s*/, '')
    if (!jsonText) return
    try {
      messages.push(JSON.parse(jsonText))
    } catch (error) {
      console.warn('[aiPlanAssistant] parse batch-operation sse line failed:', error, jsonText.slice(0, 120))
    }
  })
  return messages
}

const lastOfType = (messages: any[], type: string) =>
  [...messages].reverse().find((message) => message?.type === type)

/** 一轮 SSE 消息 → 页面要展示的结果；服务端报错或没有任何结果时抛出。 */
export function interpretBatchOperationMessages(messages: any[]): AiPlanAssistantResult {
  const error = lastOfType(messages, 'error')
  if (error?.message) throw new Error(String(error.message))

  const preview = lastOfType(messages, 'preview_result')
  if (preview?.updatedTrainingDays) {
    const pendingActions = Array.isArray(preview.pendingActions) ? preview.pendingActions : []
    if (pendingActions.length > 0) {
      throw new Error('AI 修改包含动作库外的新动作，请先在 Web 端完成动作确认后再应用')
    }
    return {
      kind: 'preview',
      originalTrainingDays: Array.isArray(preview.originalTrainingDays) ? preview.originalTrainingDays : [],
      updatedTrainingDays: preview.updatedTrainingDays,
      modifications: Array.isArray(preview.modifications) ? preview.modifications : [],
      pendingActions,
      oneRmAdjustments: Array.isArray(preview.oneRmAdjustments) ? preview.oneRmAdjustments : [],
      restoredLockedDayIndexes: Array.isArray(preview.restoredLockedDayIndexes) ? preview.restoredLockedDayIndexes : [],
      message: String(preview.message || ''),
      assistantMessage: String(lastOfType(messages, 'assistant_message')?.content || preview.message || ''),
    }
  }

  const clarification = lastOfType(messages, 'need_clarification')
  if (clarification?.question) {
    return {
      kind: 'clarification',
      question: String(clarification.question),
      suggestions: Array.isArray(clarification.suggestions)
        ? clarification.suggestions.filter((item: unknown) => typeof item === 'string').slice(0, 8)
        : [],
    }
  }

  const answer = lastOfType(messages, 'query_result')
  if (answer) return { kind: 'answer', answer: String(answer.answer || '') }

  throw new Error('AI 暂未返回可预览的计划修改')
}

/** 多轮里同一动作的 1RM 调整以最新一轮为准，其余轮次的调整保留。 */
export function mergeOneRmAdjustments(
  previous: AiPlanAssistantOneRm[],
  incoming: AiPlanAssistantOneRm[],
): AiPlanAssistantOneRm[] {
  const byAction = new Map<string, AiPlanAssistantOneRm>()
  for (const item of [...(previous || []), ...(incoming || [])]) {
    if (item?.actionId) byAction.set(String(item.actionId), item)
  }
  return Array.from(byAction.values())
}

type StudentActionRef = {
  id: string
  name?: string | null
  canonical_action_id?: string | null
}

const normalizeName = (name?: string | null) => String(name || '').trim().toLowerCase()

/** 把 AI 的 1RM 调整映射到学员动作库，供 batch-update-student-1rm 使用。 */
export function buildOneRmUpdates(
  adjustments: AiPlanAssistantOneRm[],
  studentActions: StudentActionRef[],
): { updates: Array<{ actionId: string; reference_1rm: number }>; unresolved: AiPlanAssistantOneRm[] } {
  const updates: Array<{ actionId: string; reference_1rm: number }> = []
  const unresolved: AiPlanAssistantOneRm[] = []
  for (const adjustment of adjustments || []) {
    const matched = adjustment.studentActionId
      ? studentActions.find((action) => action.id === adjustment.studentActionId)
      : studentActions.find((action) =>
        (adjustment.canonicalActionId && action.canonical_action_id === adjustment.canonicalActionId) ||
        normalizeName(action.name) === normalizeName(adjustment.actionName)
      )
    const actionId = matched?.id || adjustment.studentActionId || null
    const value = Number(adjustment.nextOneRM)
    if (!actionId || !Number.isFinite(value) || value <= 0) {
      unresolved.push(adjustment)
      continue
    }
    updates.push({ actionId, reference_1rm: value })
  }
  return { updates, unresolved }
}

export function describeAiPlanAssistantTurn(result: AiPlanAssistantResult): string {
  if (result.kind === 'preview') return result.assistantMessage || result.message || 'AI 已生成计划修改预览'
  if (result.kind === 'clarification') return result.question
  return result.answer
}
