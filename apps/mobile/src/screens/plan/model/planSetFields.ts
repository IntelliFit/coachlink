/**
 * 动作项字段的读取顺序和保存前规范化，移植自小程序 `coach/students/plan/index.tsx`
 * 的 getActionSet* 与 normalizeTrainingDaysForSave。
 *
 * 同一个字段在不同编辑器里存在不同位置（顶层 sets、params.sets、params['组数']…），
 * 执行端（execution/start）、计划锁（planEditLock）和小程序各自按不同顺序读取，
 * 所以保存前必须把所有别名写成同一个值，否则 APP 改了、学员练的还是旧值。
 */
import type { PlanActionOption, PlanActionSet, PlanTrainingDay } from './planTypes'

const toFiniteNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const normalizeActionId = (value: unknown) => {
  const text = String(value ?? '').trim()
  return text && text !== 'undefined' && text !== 'null' ? text : ''
}

const isPlaceholderActionName = (name?: string | null) => {
  const text = String(name || '').trim()
  if (!text) return true
  const compact = text.replace(/\s+/g, '')
  return compact === '未选择动作' || compact === '未选择' || /^动作\d+$/i.test(compact)
}

export const getSetActionId = (set?: PlanActionSet | null) =>
  normalizeActionId(set?.action_id ?? set?.actionId ?? set?.params?.action_id ?? set?.params?.actionId)

export const getSetRawName = (set?: PlanActionSet | null) => {
  const candidates = [
    set?.group_title,
    set?.question?.question,
    set?.action_name,
    set?.set_name,
    set?.actionName,
    set?.setName,
    set?.params?.action_name,
    set?.params?.actionName,
    set?.params?.setName,
    set?.params?.name,
    set?.params?.['动作名称'],
  ].map((candidate) => String(candidate || '').trim())
  return candidates.find((text) => text && !isPlaceholderActionName(text)) || candidates.find(Boolean) || ''
}

export const getSetSets = (set?: PlanActionSet | null) => {
  for (const candidate of [set?.sets, set?.params?.sets, set?.params?.['组数']]) {
    const value = toFiniteNumber(candidate)
    if (value !== null && value > 0) return Math.floor(value)
  }
  return null
}

export const getSetReps = (set?: PlanActionSet | null) => {
  for (const candidate of [set?.reps, set?.params?.reps, set?.params?.['次数']]) {
    const value = toFiniteNumber(candidate)
    if (value !== null && value > 0) return Math.floor(value)
  }
  return null
}

export const getSetWeight = (set?: PlanActionSet | null) => {
  for (const candidate of [set?.weight, set?.params?.load, set?.params?.weight, set?.params?.['重量'], set?.params?.['杠铃负重(备选)']]) {
    const value = toFiniteNumber(candidate)
    if (value !== null && value >= 0) return value
  }
  return null
}

/** 按执行端（execution/start）的读取顺序：params['休息时间'] → 顶层 rest_seconds → params.rest_seconds。 */
export const getSetRestSeconds = (set?: PlanActionSet | null) => {
  for (const candidate of [set?.params?.['休息时间'], set?.rest_seconds, set?.params?.rest_seconds]) {
    const value = toFiniteNumber(candidate)
    if (value !== null && value >= 0) return value
  }
  return null
}

/** 备注存在 params.note（执行端读 params.note || note）。 */
export const getSetNote = (set?: PlanActionSet | null) => String(set?.params?.note ?? set?.note ?? '')

export function withSetNote(set: PlanActionSet, note: string): PlanActionSet {
  const { note: _legacy, ...rest } = set
  return { ...rest, params: { ...(set.params || {}), note } }
}

export function withSetCounts(set: PlanActionSet, patch: { sets?: number; reps?: number; restSeconds?: number }): PlanActionSet {
  const params = { ...(set.params || {}) }
  const next: PlanActionSet = { ...set }
  if (patch.sets !== undefined) {
    next.sets = patch.sets
    params.sets = patch.sets
    params['组数'] = patch.sets
  }
  if (patch.reps !== undefined) {
    next.reps = patch.reps
    params.reps = patch.reps
    params['次数'] = patch.reps
  }
  if (patch.restSeconds !== undefined) {
    params.rest_seconds = patch.restSeconds
    params['休息时间'] = patch.restSeconds
    if (set.rest_seconds !== undefined) next.rest_seconds = patch.restSeconds
  }
  return { ...next, params }
}

/** 固定重量：所有读取位置写成同一个值（小程序教练页先读 intensityConfig.fixedWeight）。 */
export function withFixedLoad(set: PlanActionSet, load: number): PlanActionSet {
  const params = { ...(set.params || {}) }
  params.load = load
  params.weight = load
  params['重量'] = load
  delete params['杠铃负重(备选)']
  const config = params.intensityConfig && typeof params.intensityConfig === 'object' ? params.intensityConfig : {}
  params.intensityConfig = { ...config, fixedWeight: load }
  return { ...set, weight: load, params }
}

/** 选中动作库条目：所有 id/名称别名一起改，旧的自定义名称清掉。 */
export function withPickedAction(set: PlanActionSet, action: PlanActionOption): PlanActionSet {
  const { set_name: _setName, ...rest } = set
  const params = { ...(set.params || {}) }
  delete params.action_id
  delete params.actionId
  delete params.action_name
  delete params.actionName
  delete params.setName
  delete params.name
  delete params['动作名称']
  return {
    ...rest,
    action_id: action.id,
    actionId: action.id,
    action_name: action.name,
    actionName: action.name,
    setName: action.name,
    params,
  }
}

/** 切到 RM / %1RM 时去掉固定重量和服务端算出来的推荐重量，否则会被读回成「固定」。 */
export function withoutFixedLoad(set: PlanActionSet): PlanActionSet {
  const { weight: _weight, ...rest } = set
  const params = { ...(set.params || {}) }
  delete params.load
  delete params.weight
  delete params['重量']
  delete params.loadCalculated
  delete params.loadSource
  // 旧数据里的备选负重也会被 getSetWeight 读到，不删的话保存时又被写回 load。
  delete params['杠铃负重(备选)']
  if (params.intensityConfig && typeof params.intensityConfig === 'object') {
    const { recommendedLoad: _recommended, fixedWeight: _fixed, ...config } = params.intensityConfig
    params.intensityConfig = Object.keys(config).length > 0 ? config : undefined
  }
  return { ...rest, params }
}

const isOneFilter = (set?: PlanActionSet | null) => Boolean(set && set.type === 'one-filter' && Array.isArray(set.actions))

function normalizeLeafSet(set: PlanActionSet): PlanActionSet {
  const actionId = getSetActionId(set)
  const sets = getSetSets(set)
  const reps = getSetReps(set)
  const weight = getSetWeight(set)
  const restSeconds = getSetRestSeconds(set)
  const name = getSetRawName(set)
  const { _uid: _editorKey, ...plain } = set
  const params: Record<string, any> = { ...(set.params || {}) }
  if (sets !== null) {
    params.sets = sets
    params['组数'] = sets
  }
  if (reps !== null) {
    params.reps = reps
    params['次数'] = reps
  }
  if (weight !== null) {
    params.load = weight
    params.weight = weight
    params['重量'] = weight
  }
  // 执行端只读 params['休息时间'] 和顶层 rest_seconds，不读 params.rest_seconds，保存前写齐。
  if (restSeconds !== null) {
    params.rest_seconds = restSeconds
    params['休息时间'] = restSeconds
  }
  return {
    ...plain,
    action_id: actionId || undefined,
    actionId: actionId || undefined,
    action_name: name || undefined,
    actionName: name || undefined,
    setName: name || undefined,
    sets: sets ?? set.sets,
    reps: reps ?? set.reps,
    weight: weight ?? set.weight,
    params,
  }
}

function normalizeSetForSave(set: PlanActionSet): PlanActionSet {
  if (isOneFilter(set)) return { ...set, actions: (set.actions || []).map(normalizeSetForSave) }
  return normalizeLeafSet(set)
}

/**
 * 与小程序 normalizeTrainingDaysForSave 一致：休息日不带动作，训练日每个动作写齐所有别名。
 * 例外：已锁定的休息日如果存着内容（planCalendar 允许），原样保留，否则服务端会判成改了已练过的天。
 */
export function normalizeDaysForSave(days: PlanTrainingDay[], options: { lockedThroughDayIndex?: number } = {}): PlanTrainingDay[] {
  const lockedThrough = options.lockedThroughDayIndex || 0
  return [...days]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day, index) => {
      const dayIndex = Number(day?.dayIndex) > 0 ? Number(day.dayIndex) : index + 1
      if (day?.type !== 'training') {
        if (dayIndex <= lockedThrough) return { ...day, dayIndex, type: 'rest', actionSets: (day.actionSets || []).map(stripEditorKey) }
        return { ...day, dayIndex, type: 'rest', actionSets: [], actionSetsCount: 0 }
      }
      const actionSets = (day.actionSets || []).map(normalizeSetForSave)
      return { ...day, dayIndex, type: 'training', actionSets, actionSetsCount: actionSets.length }
    })
}

function stripEditorKey(set: PlanActionSet): PlanActionSet {
  const { _uid: _editorKey, ...rest } = set
  return rest
}

let uidCounter = 0
const nextUid = () => {
  uidCounter += 1
  return `set-${Date.now().toString(36)}-${uidCounter}`
}

/**
 * 编辑器内用的稳定键（`_uid`，保存前去掉）：同一动作出现两次或都未选动作时，
 * 移动/删除后本地输入状态不会串到别的卡片。缺失或重复（复制天/周产生）时补新的。
 */
export function ensureSetUids(days: PlanTrainingDay[]): PlanTrainingDay[] {
  const seen = new Set<string>()
  let changed = false
  const next = days.map((day) => {
    let dayChanged = false
    const actionSets = (day.actionSets || []).map((set) => {
      const uid = typeof set._uid === 'string' ? set._uid : ''
      if (uid && !seen.has(uid)) {
        seen.add(uid)
        return set
      }
      const fresh = nextUid()
      seen.add(fresh)
      dayChanged = true
      return { ...set, _uid: fresh }
    })
    if (!dayChanged) return day
    changed = true
    return { ...day, actionSets }
  })
  return changed ? next : days
}
