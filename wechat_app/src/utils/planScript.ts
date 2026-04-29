import type { PlanActionOption, PlanActionSet, PlanTrainingDay } from '@/types/plan'
import {
  getActionIdFromSet,
  normalizeItemType,
  normalizePlanDays,
  resolveActionDisplayName
} from '@/utils/planEditor'

interface MatchedAction {
  id: string
  name: string
  type?: string | null
  score: number
}

export interface ParsePlanScriptParams {
  script: string
  actions: PlanActionOption[]
}

export interface ParsePlanScriptResult {
  description: string | null
  days: PlanTrainingDay[]
}

const toDayIndex = (weekIndex: number, dayOfWeek: number) => (weekIndex - 1) * 7 + dayOfWeek

const normalizeActionNameForExactMatch = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')

const normalizeActionNameForFuzzyMatch = (value?: string | null) =>
  normalizeActionNameForExactMatch(value)
    .replace(/[()]/g, '')
    .replace(/[._\-_/\\·,，。:：;；]/g, '')

const hasVariantMarker = (value?: string | null) => /[（(][^）)]*[）)]/.test(String(value || ''))

const uniqueBigrams = (value: string) => {
  if (value.length <= 1) return [value]
  const result = new Set<string>()
  for (let index = 0; index < value.length - 1; index += 1) {
    result.add(value.slice(index, index + 2))
  }
  return Array.from(result)
}

const diceCoefficient = (left: string, right: string) => {
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.9

  const leftBigrams = uniqueBigrams(left)
  const rightBigrams = uniqueBigrams(right)
  const rightSet = new Set(rightBigrams)
  const overlap = leftBigrams.filter((item) => rightSet.has(item)).length
  return (2 * overlap) / Math.max(1, leftBigrams.length + rightBigrams.length)
}

const resolveScriptAction = (actionName: string, actions: PlanActionOption[]): MatchedAction => {
  const exactName = normalizeActionNameForExactMatch(actionName)
  const exactMatches = actions.filter((action) => normalizeActionNameForExactMatch(action.name) === exactName)

  if (exactMatches.length === 1) {
    const matched = exactMatches[0]
    return { id: matched.id, name: matched.name, type: matched.type, score: 1 }
  }

  if (exactMatches.length > 1) {
    throw new Error(`动作名称存在多个完全匹配项：${actionName}`)
  }

  if (hasVariantMarker(actionName)) {
    throw new Error(`未找到精确动作：${actionName}`)
  }

  const target = normalizeActionNameForFuzzyMatch(actionName)
  let best: MatchedAction | null = null

  actions.forEach((action) => {
    const source = normalizeActionNameForFuzzyMatch(action.name)
    if (!source) return
    const score = diceCoefficient(target, source)
    if (!best || score > best.score) {
      best = { id: action.id, name: action.name, type: action.type, score }
    }
  })

  if (!best || best.score < 0.78) {
    throw new Error(`未找到动作：${actionName}`)
  }

  return best
}

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const readParamNumber = (set: PlanActionSet, keys: string[]) => {
  for (const key of keys) {
    const value = parseNumber((set as any)[key])
    if (value !== null) return value
    const paramValue = parseNumber((set.params || {})[key])
    if (paramValue !== null) return paramValue
  }
  return null
}

const parseIntensityToken = (token: string): Record<string, any> => {
  const text = token.trim().toLowerCase()
  const rmMatch = text.match(/^@(\d+(?:\.\d+)?)rm$/)
  if (rmMatch) {
    const value = Number(rmMatch[1])
    return {
      intensity: `${value}RM`,
      '强度': value,
      intensityConfig: {
        relativeIntensity: { type: 'rm', value }
      }
    }
  }

  const percentMatch = text.match(/^@(\d+(?:\.\d+)?)%$/)
  if (percentMatch) {
    const value = Number(percentMatch[1])
    return {
      intensity: `${value}%`,
      '强度': `${value}%1RM`,
      intensityConfig: {
        relativeIntensity: { type: 'percentage', value }
      }
    }
  }

  const kgMatch = text.match(/^@(\d+(?:\.\d+)?)kg$/)
  if (kgMatch) {
    const value = Number(kgMatch[1])
    return {
      load: value,
      weight: value,
      '重量': value,
      intensity: '',
      intensityConfig: {
        fixedWeight: { value, unit: 'kg' }
      }
    }
  }

  throw new Error(`无法解析强度标记：${token}`)
}

const parseActionLine = (line: string, actions: PlanActionOption[]): PlanActionSet => {
  let working = line.trim()
  let note = ''
  const noteMatch = working.match(/\s+#(.+)$/)
  if (noteMatch) {
    note = noteMatch[1].trim()
    working = working.slice(0, noteMatch.index).trim()
  }

  const tokens = working.split(/\s+/).filter(Boolean)
  const nameTokens: string[] = []
  const params: Record<string, any> = {
    note,
    load: '',
    intensity: '',
    intensityConfig: null
  }

  let sets: number | null = null
  let reps: number | null = null
  let durationSeconds: number | null = null
  let restSeconds: number | null = null

  tokens.forEach((token) => {
    const volumeMatch = token.match(/^(\d+)x(\d+(?:\.\d+)?)(s)?$/i)
    if (volumeMatch) {
      sets = Number(volumeMatch[1])
      if (volumeMatch[3]) {
        durationSeconds = Number(volumeMatch[2])
      } else {
        reps = Number(volumeMatch[2])
      }
      return
    }

    const restMatch = token.match(/^r(\d+)$/i)
    if (restMatch) {
      restSeconds = Number(restMatch[1])
      return
    }

    if (token.startsWith('@')) {
      Object.assign(params, parseIntensityToken(token))
      return
    }

    nameTokens.push(token)
  })

  const actionName = nameTokens.join(' ').trim()
  if (!actionName) {
    throw new Error(`动作行缺少动作名称：${line}`)
  }

  const matched = resolveScriptAction(actionName, actions)

  if (sets !== null) {
    params.sets = sets
    params['组数'] = sets
  }
  if (reps !== null) {
    params.reps = reps
    params['次数'] = reps
  }
  if (durationSeconds !== null) {
    params.duration_seconds = durationSeconds
    params['持续时间'] = durationSeconds
  }
  if (restSeconds !== null) {
    params.rest_seconds = restSeconds
    params['休息时间'] = restSeconds
  }

  return {
    type: 'no-filter',
    itemType: normalizeItemType(matched.type),
    actionId: matched.id,
    action_id: matched.id,
    actionName: matched.name,
    action_name: matched.name,
    setName: actionName,
    set_name: actionName,
    sets: sets ?? undefined,
    reps: reps ?? undefined,
    weight: parseNumber(params.load) ?? undefined,
    note,
    params
  }
}

const formatActionSetLine = (set: PlanActionSet, actions: PlanActionOption[]) => {
  if (set.type === 'one-filter' && Array.isArray(set.actions)) {
    throw new Error('脚本模式暂不支持条件分支动作，请先在普通编辑器里处理。')
  }

  const actionName = resolveActionDisplayName(set, actions)
  const params = set.params || {}
  const parts = [actionName]
  const sets = readParamNumber(set, ['sets', '组数'])
  const reps = readParamNumber(set, ['reps', '次数'])
  const durationSeconds = readParamNumber(set, ['duration_seconds', '持续时间'])

  if (sets !== null) {
    if (durationSeconds !== null) {
      parts.push(`${Math.floor(sets)}x${durationSeconds}s`)
    } else if (reps !== null) {
      parts.push(`${Math.floor(sets)}x${reps}`)
    }
  }

  const relative = params.intensityConfig?.relativeIntensity
  const fixedWeight = params.intensityConfig?.fixedWeight
  const rawIntensity = String(params.intensity || params['强度'] || '').trim()
  const rawLoad = parseNumber(params.load ?? params.weight ?? params['重量'])

  if (relative?.type === 'rm' && Number.isFinite(Number(relative.value))) {
    parts.push(`@${relative.value}rm`)
  } else if (relative?.type === 'percentage' && Number.isFinite(Number(relative.value))) {
    parts.push(`@${relative.value}%`)
  } else if (fixedWeight?.value !== undefined && Number.isFinite(Number(fixedWeight.value))) {
    parts.push(`@${fixedWeight.value}${fixedWeight.unit || 'kg'}`)
  } else if (/^\d+(?:\.\d+)?\s*rm$/i.test(rawIntensity)) {
    parts.push(`@${rawIntensity.replace(/\s+/g, '').toLowerCase()}`)
  } else if (/^\d+(?:\.\d+)?\s*%/.test(rawIntensity)) {
    parts.push(`@${rawIntensity.replace(/\s+/g, '').replace(/1RM$/i, '')}`)
  } else if (rawLoad !== null && rawLoad > 0) {
    parts.push(`@${rawLoad}kg`)
  }

  const restSeconds = readParamNumber(set, ['rest_seconds', '休息时间'])
  if (restSeconds !== null && restSeconds > 0) {
    parts.push(`r${Math.floor(restSeconds)}`)
  }

  const note = String(params.note || set.note || '').trim()
  if (note) parts.push(`#${note}`)

  return parts.join(' ')
}

export const formatPlanToScript = (params: {
  description?: string | null
  days: PlanTrainingDay[]
  actions: PlanActionOption[]
}) => {
  const lines: string[] = []
  const description = String(params.description || '').trim()
  const days = normalizePlanDays(params.days || [])
    .slice()
    .sort((left, right) => left.dayIndex - right.dayIndex)

  if (description) {
    description.split(/\r?\n/).forEach((line) => {
      const text = line.trim()
      if (text) lines.push(`> ${text}`)
    })
    lines.push('')
  }

  let currentWeek = -1
  days.forEach((day) => {
    const dayIndex = Number(day.dayIndex || 1)
    const weekIndex = Math.ceil(dayIndex / 7)
    const dayOfWeek = ((dayIndex - 1) % 7) + 1

    if (weekIndex !== currentWeek) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
      lines.push(`W${weekIndex}`)
      currentWeek = weekIndex
    }

    const note = String(day.note || '').trim()
    if (day.type === 'rest') {
      lines.push(`D${dayOfWeek} off${note ? ` #${note}` : ''}`)
      return
    }

    lines.push(`D${dayOfWeek}`)
    if (note) lines.push(`!${note}`)
    ;(day.actionSets || []).forEach((set) => {
      lines.push(formatActionSetLine(set, params.actions))
    })
    lines.push('')
  })

  return lines.join('\n').trim()
}

export const parsePlanScript = ({ script, actions }: ParsePlanScriptParams): ParsePlanScriptResult => {
  const lines = String(script || '').replace(/\r\n/g, '\n').split('\n')
  const descriptionLines: string[] = []
  const days = new Map<number, PlanTrainingDay>()
  let currentWeek = 0
  let currentDay: PlanTrainingDay | null = null

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return

    if (line.startsWith('>')) {
      descriptionLines.push(line.slice(1).trim())
      return
    }

    const weekMatch = line.match(/^W(\d+)$/i)
    if (weekMatch) {
      currentWeek = Number(weekMatch[1])
      currentDay = null
      return
    }

    const restDayMatch = line.match(/^D(\d+)\s+off(?:\s+(?:#|!)(.*))?$/i)
    if (restDayMatch) {
      if (!currentWeek) throw new Error(`休息日出现在周标题之前：${line}`)
      const dayOfWeek = Number(restDayMatch[1])
      if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error(`日期只能写 D1-D7：${line}`)
      currentDay = {
        dayIndex: toDayIndex(currentWeek, dayOfWeek),
        type: 'rest',
        note: restDayMatch[2]?.trim() || '',
        actionSets: []
      }
      days.set(currentDay.dayIndex, currentDay)
      return
    }

    const dayMatch = line.match(/^D(\d+)$/i)
    if (dayMatch) {
      if (!currentWeek) throw new Error(`训练日出现在周标题之前：${line}`)
      const dayOfWeek = Number(dayMatch[1])
      if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error(`日期只能写 D1-D7：${line}`)
      currentDay = {
        dayIndex: toDayIndex(currentWeek, dayOfWeek),
        type: 'training',
        note: '',
        actionSets: []
      }
      days.set(currentDay.dayIndex, currentDay)
      return
    }

    if (!currentDay) {
      throw new Error(`无法识别的脚本行：${line}`)
    }

    if (line.startsWith('!')) {
      currentDay.note = line.slice(1).trim()
      return
    }

    if (currentDay.type !== 'training') {
      throw new Error(`休息日不能包含动作行：${line}`)
    }

    currentDay.actionSets = currentDay.actionSets || []
    currentDay.actionSets.push(parseActionLine(line, actions))
  })

  return {
    description: descriptionLines.length > 0 ? descriptionLines.join('\n') : null,
    days: Array.from(days.values()).sort((left, right) => left.dayIndex - right.dayIndex)
  }
}

export const getPlanScriptErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return '脚本解析失败，请检查格式。'
}
