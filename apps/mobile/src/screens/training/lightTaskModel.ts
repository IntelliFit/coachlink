/**
 * 今日训练「添加轻任务」（饮食 / 有氧 / 习惯），与小程序 TodayTrainingScreen.handleAddLightweightTask 一致。
 * 注意单位：执行记录里有氧距离按米、时长按秒存（计划编辑器里的 custom_data.distance 是公里，两者不同）。
 */

export type LightTaskType = 'DIET' | 'CARDIO' | 'HABIT'

export const LIGHT_TASK_TYPES: LightTaskType[] = ['DIET', 'CARDIO', 'HABIT']

export const LIGHT_TASK_LABELS: Record<LightTaskType, string> = { DIET: '饮食', CARDIO: '有氧', HABIT: '习惯' }

export type LightTaskForm = {
  suggestedTime: string
  notes: string
  dietContent: string
  cardioDistanceKm: string
  cardioDurationMin: string
  cardioPace: string
  habitName: string
  habitTargetMin: string
}

export function lightTaskType(action: { type?: string | null } | null | undefined): LightTaskType | null {
  const type = String(action?.type || '').toUpperCase()
  return (LIGHT_TASK_TYPES as string[]).includes(type) ? (type as LightTaskType) : null
}

/** 选中动作库条目时，用动作上保存的默认值预填表单（与小程序 handleSelectLightweightAction 一致）。 */
export function initialLightTaskForm(action: { type?: string | null; name?: string | null; attrs?: unknown }): LightTaskForm {
  const type = lightTaskType(action)
  const attrs = action?.attrs && typeof action.attrs === 'object' && !Array.isArray(action.attrs) ? (action.attrs as Record<string, any>) : {}
  const custom = attrs.custom_data || {}
  return {
    suggestedTime: String(attrs.suggested_time || '').trim(),
    notes: String(attrs.note || '').trim(),
    dietContent: type === 'DIET' ? String(custom.content || '').trim() : '',
    cardioDistanceKm: type === 'CARDIO' && custom.distance ? `${Number(custom.distance) / 1000}` : '',
    cardioDurationMin: type === 'CARDIO' && custom.duration ? `${Math.round(Number(custom.duration) / 60)}` : '',
    cardioPace: type === 'CARDIO' ? String(custom.pace || '').trim() : '',
    habitName: type === 'HABIT' ? String(custom.habit_name || action?.name || '').trim() : '',
    habitTargetMin: type === 'HABIT' && custom.target_duration ? `${Number(custom.target_duration)}` : '',
  }
}

const positive = (text: string) => {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function buildLightTaskCustomData(type: LightTaskType, form: LightTaskForm, fallbackName: string) {
  if (type === 'DIET') return { content: form.dietContent.trim() || undefined }
  if (type === 'CARDIO') {
    const distance = positive(form.cardioDistanceKm)
    const duration = positive(form.cardioDurationMin)
    return {
      distance: distance === null ? undefined : Math.round(distance * 1000),
      duration: duration === null ? undefined : Math.round(duration * 60),
      pace: form.cardioPace.trim() || undefined,
    }
  }
  const target = positive(form.habitTargetMin)
  return {
    habit_name: form.habitName.trim() || fallbackName,
    target_duration: target === null ? undefined : Math.round(target),
  }
}

/** 当天执行记录里学员自己加的轻任务（可删除），与小程序 dayModules.extraExecutionTasks 的判断一致。 */
export function studentExtraTasks(execution: any) {
  const actions: any[] = Array.isArray(execution?.action_executions) ? execution.action_executions : []
  return actions
    .map((item, executionIndex) => ({ item, executionIndex }))
    .filter(({ item }) => item?.source === 'student_extra' || (Boolean(item?.source_action_id) && !item?.source))
    .map(({ item, executionIndex }) => ({
      executionIndex,
      title: String(item?.action_name || item?.name || '未命名任务'),
      type: lightTaskType({ type: item?.item_type || item?.itemType || item?.type }),
      completed: item?.status === 'completed' || item?.completed === true || (typeof item?.total_sets === 'number' && item.total_sets > 0 && item.completed_sets === item.total_sets),
    }))
}

/** 本地先移除被删的轻任务（服务端按数组下标删除并重排，删完必须立刻更新本地列表，否则下一次删除会错位）。 */
export function removeActionAt(execution: any, index: number) {
  const actions: any[] = Array.isArray(execution?.action_executions) ? execution.action_executions : []
  if (!execution || index < 0 || index >= actions.length) return null
  const removed = actions[index]
  const removedSets = Number(removed?.total_sets ?? (Array.isArray(removed?.sets) ? removed.sets.length : 1)) || 0
  const removedDone = Number(removed?.completed_sets ?? 0) || 0
  return {
    ...execution,
    action_executions: actions.filter((_, position) => position !== index),
    total_sets: Math.max(0, Number(execution.total_sets || 0) - removedSets),
    completed_sets: Math.max(0, Number(execution.completed_sets || 0) - removedDone),
  }
}
