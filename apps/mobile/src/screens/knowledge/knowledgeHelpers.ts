export type PublicTrainingPlanLevel = 'beginner' | 'intermediate' | 'advanced'

export const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '专业',
}

export function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export function pickObject<T = any>(data: any, keys: string[]): T | null {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (value && typeof value === 'object') return value as T
  }
  return null
}

export function toNumber(value: any) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function formatRest(value: any) {
  const seconds = toNumber(value)
  if (seconds === null || seconds <= 0) return '按动作安排'
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  if (seconds > 120) return `${(seconds / 60).toFixed(1)} 分钟`
  return `${seconds} 秒`
}

export function formatMetric(value: any, fallback = '按计划') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function getTrainingDayCount(plan: any) {
  const days = Array.isArray(plan?.trainingDays) ? plan.trainingDays : []
  return days.filter((day: any) => day?.type === 'training').length
}

export function getActionDetail(action: any) {
  const params = action?.params || {}
  const actionId = String(action?.actionId || action?.action_id || '').trim()
  return {
    actionId,
    actionName: String(action?.actionName || action?.action_name || action?.setName || action?.set_name || '').trim() || '未命名动作',
    sets: formatMetric(params['组数'] ?? params.sets ?? action?.sets ?? 1),
    reps: formatMetric(params['次数'] ?? params.reps ?? action?.reps ?? ''),
    rest: formatRest(params['休息时间'] ?? params.rest_seconds ?? action?.rest_seconds ?? null),
    intensity: formatMetric(params['强度'] ?? params.intensity ?? action?.intensity ?? '', ''),
    load: toNumber(params.load ?? action?.load ?? null),
  }
}

export function stripHtmlToText(input: unknown) {
  const text = typeof input === 'string' ? input : ''
  if (!text.trim()) return ''
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeContentBody(content: unknown) {
  if (!content) return ''
  if (typeof content === 'string') return stripHtmlToText(content)
  if (typeof content !== 'object') return ''
  const object = content as { body?: unknown; html?: unknown; markdown?: unknown }
  return stripHtmlToText(object.body || object.html || object.markdown || '')
}

export function normalizeBookContent(content: unknown) {
  if (typeof content === 'string') {
    return {
      text: stripHtmlToText(content),
      disclaimer: '',
      prompts: [] as Array<{ title?: string; intent?: string; prompt?: string }>,
      source: null as any,
    }
  }

  if (content && typeof content === 'object') {
    const structured = content as any
    return {
      text: stripHtmlToText(structured.html || structured.markdown || structured.body || ''),
      disclaimer: String(structured.disclaimer || '').trim(),
      prompts: Array.isArray(structured.imagePrompts) ? structured.imagePrompts : [],
      source: structured.source || structured._source || null,
    }
  }

  return {
    text: '',
    disclaimer: '',
    prompts: [] as Array<{ title?: string; intent?: string; prompt?: string }>,
    source: null as any,
  }
}

export function getBookSource(content: unknown) {
  if (!content || typeof content !== 'object') return null
  const source = (content as any).source || (content as any)._source || null
  if (!source || typeof source !== 'object') return null
  return source
}
