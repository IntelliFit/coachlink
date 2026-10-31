import { describeLockedRange, getLockedThroughDayIndex, mergeLockedPlanDays } from '@coachlink/core/src/planEditLock'
import { addBeijingDays, toBeijingDateKey } from '@coachlink/core/src/beijingTime'

export type AssignPlanMode = 'overwrite' | 'new_instance'

/**
 * 分配计划的请求，与小程序 coach/students/assign-plan handleAssignPlan 一致：
 * - 覆盖当前计划且还没练过：原地 update-instance；
 * - 覆盖当前计划且已有训练：create-instance 带 revisionOfInstanceId，已练过的天保持原样，模板从之后生效，沿用原日历起点；
 * - 新建阶段（或当前没有计划）：create-instance 新实例。
 */
export function buildAssignPlanRequest(params: {
  mode: AssignPlanMode
  subscriptionId: string
  template: any
  templateDays: any[]
  startDayIndex: number
  currentPlan?: any | null
  executionsByDayIndex?: Record<number, any> | null
  today?: Date
}) {
  const { subscriptionId, template, templateDays, currentPlan } = params
  const existingInstanceId = currentPlan?.id ? String(currentPlan.id) : ''
  const overwrite = Boolean(existingInstanceId) && params.mode === 'overwrite'
  const executions = Object.values(params.executionsByDayIndex || {}).filter(Boolean)
  const hasExecutionHistory = executions.length > 0

  const resolvedDayIndexes = new Set(
    executions
      .filter((execution: any) => ['completed', 'abandoned'].includes(String(execution?.status || '').toLowerCase()))
      .map((execution: any) => Number(execution?.day_index ?? execution?.dayIndex ?? 0))
      .filter((dayIndex) => dayIndex > 0),
  )
  const firstUnresolvedTrainingDay = templateDays
    .filter((day: any) => day?.type === 'training')
    .map((day: any) => Number(day?.dayIndex ?? day?.day_index ?? 0))
    .filter((dayIndex: number) => dayIndex > 0 && !resolvedDayIndexes.has(dayIndex))
    .sort((left: number, right: number) => left - right)[0]
  const effectiveStartDayIndex = overwrite && hasExecutionHistory
    ? Math.max(params.startDayIndex, firstUnresolvedTrainingDay || params.startDayIndex)
    : params.startDayIndex
  const startWeek = Math.floor((effectiveStartDayIndex - 1) / 7) + 1
  const startDay = ((effectiveStartDayIndex - 1) % 7) + 1

  const base = {
    templateId: template?.id,
    name: template?.name || '训练计划',
    description: template?.description || null,
  }

  if (overwrite && !hasExecutionHistory) {
    return {
      endpoint: '/api/plan-lib/update-instance' as const,
      body: { id: existingInstanceId, ...base, startExecutionDay: effectiveStartDayIndex, trainingDays: templateDays },
      keepsTrainedDays: false,
      lockedThroughDayIndex: 0,
    }
  }

  const lockedThroughDayIndex = overwrite ? getLockedThroughDayIndex(executions as any[]) : 0
  const keepsTrainedDays = overwrite && lockedThroughDayIndex > 0
  const trainingDays = keepsTrainedDays
    ? mergeLockedPlanDays({ savedDays: currentPlan?.training_days || [], nextDays: templateDays, lockedThroughDayIndex }).days
    : templateDays
  const today = params.today || new Date()
  const startDate = overwrite && currentPlan?.start_date
    ? String(currentPlan.start_date).slice(0, 10)
    : toBeijingDateKey(addBeijingDays(today, -(effectiveStartDayIndex - 1)))

  return {
    endpoint: '/api/plan-lib/create-instance' as const,
    body: {
      subscriptionId,
      ...base,
      executionNotice: template?.execution_notice || template?.executionNotice || undefined,
      tags: template?.tags || null,
      type: template?.type || null,
      suitableFor: template?.suitable_for || template?.suitableFor || null,
      trainingDays,
      revisionOfInstanceId: overwrite ? existingInstanceId : undefined,
      startDate,
      startWeek,
      startDay,
    },
    keepsTrainedDays,
    lockedThroughDayIndex,
  }
}

export function assignPlanSuccessMessage(result: { keepsTrainedDays: boolean; lockedThroughDayIndex: number }) {
  return result.keepsTrainedDays
    ? `已保留${describeLockedRange(result.lockedThroughDayIndex)}，模板从第${result.lockedThroughDayIndex + 1}天起生效`
    : '新计划已同步到学员训练首页。'
}
