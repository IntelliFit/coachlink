/**
 * 组间休息的实际时长（见 DECISIONS 2026-11-05）。
 *
 * 计划间歇是组上的 planned_rest_seconds；训练中倒计时可以 ±15 秒、跳过，
 * 这些只影响本次倒计时，不改计划。倒计时结束时把「本次休息实际走了多久」
 * 写到刚完成的那一组的 actual_rest_seconds：
 * - 倒计时自然走完（包括离开页面期间走完）：记到截止时刻；
 * - 跳过 / 开始下一组 / 用 −15s 减到 0：记到点按的时刻。
 */

/** 单次休息最多记 3 小时，超出视为异常时钟，不记录。 */
export const MAX_ACTUAL_REST_SECONDS = 3 * 60 * 60

export interface RestTarget {
  executionId: string
  actionIndex: number
  setIndex: number
  /** 开始休息的时间戳（ms），即完成该组的时刻 */
  startedAt: number
}

export function normalizeRestSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_ACTUAL_REST_SECONDS) return null
  return Math.round(seconds)
}

/** 休息结束时刻取「实际结束」和「倒计时截止」中较早的那个。 */
export function computeActualRestSeconds(params: { startedAt: number; deadlineAt: number; endedAt: number }): number | null {
  const { startedAt, deadlineAt, endedAt } = params
  if (![startedAt, endedAt].every(Number.isFinite) || startedAt <= 0) return null
  const end = Number.isFinite(deadlineAt) && deadlineAt > 0 ? Math.min(endedAt, deadlineAt) : endedAt
  return normalizeRestSeconds(Math.max(0, (end - startedAt) / 1000))
}

export function isRestTarget(value: unknown): value is RestTarget {
  const target = value as RestTarget | null
  return !!target &&
    typeof target.executionId === 'string' && target.executionId.length > 0 &&
    Number.isInteger(target.actionIndex) && target.actionIndex >= 0 &&
    Number.isInteger(target.setIndex) && target.setIndex >= 0 &&
    Number.isFinite(target.startedAt) && target.startedAt > 0
}

/** 训练中调整了动作顺序（order[新位置] = 旧下标）时，把待记录的组换到新下标。 */
export function remapRestTarget(target: RestTarget | null, order: number[]): RestTarget | null {
  if (!target) return null
  const actionIndex = order.indexOf(target.actionIndex)
  return actionIndex >= 0 ? { ...target, actionIndex } : null
}

/** POST /api/{execution|impromptu}/record-rest 的请求体。 */
export interface RecordRestInput {
  executionId: string
  actionIndex: number
  setIndex: number
  actualRestSeconds: number
  /** executionActionKey(该动作)，用于发现记录期间动作顺序被别处改过 */
  actionKey: string
}

export function parseRecordRestInput(body: unknown): RecordRestInput | null {
  const raw = body as Partial<Record<keyof RecordRestInput, unknown>> | null
  if (!raw || typeof raw !== 'object') return null
  const executionId = typeof raw.executionId === 'string' ? raw.executionId.trim() : ''
  const actionKey = typeof raw.actionKey === 'string' ? raw.actionKey : ''
  const actualRestSeconds = normalizeRestSeconds(raw.actualRestSeconds)
  const { actionIndex, setIndex } = raw
  if (!executionId || !actionKey || actualRestSeconds === null) return null
  if (!Number.isInteger(actionIndex) || (actionIndex as number) < 0) return null
  if (!Number.isInteger(setIndex) || (setIndex as number) < 0) return null
  return { executionId, actionIndex: actionIndex as number, setIndex: setIndex as number, actualRestSeconds, actionKey }
}

interface RestAction { sets?: unknown }

export type ApplyActualRestResult<T> =
  | { ok: true; actions: T[] }
  | { ok: false; reason: 'invalid_seconds' | 'set_not_found' | 'set_not_completed' }

/** 返回写好 actual_rest_seconds 的新动作数组，不修改入参。只能写已完成的组。 */
export function applyActualRest<T extends RestAction>(
  actions: T[],
  actionIndex: number,
  setIndex: number,
  seconds: unknown,
): ApplyActualRestResult<T> {
  const value = normalizeRestSeconds(seconds)
  if (value === null) return { ok: false, reason: 'invalid_seconds' }
  const sets = Array.isArray(actions?.[actionIndex]?.sets) ? actions[actionIndex].sets as any[] : null
  const set = sets?.[setIndex]
  if (!set) return { ok: false, reason: 'set_not_found' }
  if (set.status !== 'completed') return { ok: false, reason: 'set_not_completed' }
  const nextActions = actions.map((action, aIdx) => {
    if (aIdx !== actionIndex) return action
    return {
      ...action,
      sets: (sets as any[]).map((item, sIdx) => (sIdx === setIndex ? { ...item, actual_rest_seconds: value } : item)),
    }
  })
  return { ok: true, actions: nextActions }
}

/** 「5分45秒」「45秒」「2分钟」；无效返回空字符串。 */
export function formatRestDuration(value: unknown): string {
  const seconds = normalizeRestSeconds(value)
  if (seconds === null) return ''
  if (seconds < 60) return `${seconds}秒`
  const m = Math.floor(seconds / 60)
  const r = seconds % 60
  return r === 0 ? `${m}分钟` : `${m}分${r}秒`
}

interface RestSet {
  planned_rest_seconds?: unknown
  actual_rest_seconds?: unknown
}

function plannedRestOf(set: RestSet | null | undefined): number | null {
  const seconds = normalizeRestSeconds(set?.planned_rest_seconds)
  return seconds !== null && seconds > 0 ? seconds : null
}

/** 「本组记录」里的休息一栏：有实际值显示实际值，和计划不同时附上计划；没有实际值时标明是计划。 */
export function formatSetRestDetail(set: RestSet | null | undefined): string {
  const actual = normalizeRestSeconds(set?.actual_rest_seconds)
  const planned = plannedRestOf(set)
  if (actual !== null) {
    const actualText = actual === 0 ? '未休息' : formatRestDuration(actual)
    return planned !== null && planned !== actual ? `${actualText}（计划 ${formatRestDuration(planned)}）` : actualText
  }
  if (planned !== null) return `计划 ${formatRestDuration(planned)}`
  return normalizeRestSeconds(set?.planned_rest_seconds) === 0 ? '无间歇' : '未设'
}

/**
 * 动作卡副标题里的间歇：已有实际休息记录时显示实际值（都一样显示一个值，不一样显示范围），
 * 否则显示计划间歇；都没有返回空字符串。
 */
export function formatActionRestSummary(sets: RestSet[] | null | undefined): string {
  const list = Array.isArray(sets) ? sets : []
  const actuals = list
    .map((set) => normalizeRestSeconds(set?.actual_rest_seconds))
    .filter((value): value is number => value !== null)
  if (actuals.length > 0) {
    const min = Math.min(...actuals)
    const max = Math.max(...actuals)
    const text = (seconds: number) => (seconds === 0 ? '0秒' : formatRestDuration(seconds))
    return min === max ? `实际间歇 ${text(min)}` : `实际间歇 ${text(min)}–${text(max)}`
  }
  const planned = plannedRestOf(list[0])
  return planned !== null ? `间歇 ${formatRestDuration(planned)}` : ''
}
