/**
 * AI 快速生成计划的配置，与小程序 coach/students getAiConfig / 生成结果提示一致。
 */

export type AiGenerationConfig = {
  startWeek: number
  startDay: number
  keepOriginalIndex: boolean
  useLLM: boolean
}

export function parseAiGenerationConfig(weekText: string, dayText: string, useLLM: boolean): AiGenerationConfig {
  const startWeek = Math.max(1, Math.floor(Number(weekText) || 1))
  const startDay = Math.max(1, Math.min(7, Math.floor(Number(dayText) || 1)))
  return { startWeek, startDay, keepOriginalIndex: true, useLLM }
}

/** 从中途开始时的说明；从第 1 周第 1 天开始返回空字符串。 */
export function aiStartHint(config: AiGenerationConfig) {
  if (config.startWeek === 1 && config.startDay === 1) return ''
  const startExecutionDay = (config.startWeek - 1) * 7 + config.startDay
  return `学员将从第 ${config.startWeek} 周第 ${config.startDay} 天开始执行，前 ${startExecutionDay - 1} 天视为已完成。`
}

/** 生成后在列表里显示的计划名：模板名是默认的「AI生成计划」时改用「某某的计划」。 */
export function aiGeneratedPlanName(templateName: unknown, studentName: string) {
  const name = String(templateName || '').trim()
  return name && !/AI\s*生成计划/.test(name) ? name : `${studentName}的计划`
}

export function bulkAiResultMessage(result: { successCount?: number; failedCount?: number } | null | undefined, useLLM: boolean) {
  const successCount = Number(result?.successCount || 0)
  const failedCount = Number(result?.failedCount || 0)
  const label = useLLM ? 'LLM' : '规则'
  return failedCount > 0 ? `${label}成功 ${successCount} 个，失败 ${failedCount} 个` : `${label}生成 ${successCount} 个`
}
