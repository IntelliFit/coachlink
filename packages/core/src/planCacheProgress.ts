import { deriveStrictSequentialProgressDay } from './planProgress';
import { buildPlanDayFacts } from './planDayFacts';
import { toBeijingDateKey } from './beijingTime';

/** Local projection only. The next cloud response still wins; cache never grants write access. */
export function projectPlanCacheProgress(block: any, today = new Date()) {
  if (!block?.instance?.training_days) return block;
  const executions = block.executionsByDayIndex || {};
  const { recommendedDayIndex, resolvedDays } = deriveStrictSequentialProgressDay({
    planDays: block.instance.training_days, startExecutionDay: Number(block.instance.start_execution_day || 1),
    executionsByDayIndex: buildPlanDayFacts(Object.values(executions)), actionsMap: block.actions || {},
    explicitStartDate: block.instance.start_date || block.instance.created_at, today,
  });
  const completionDates: Record<string, string> = {};
  for (const [day, e] of Object.entries(executions) as [string, any][]) {
    if (e?.status === 'completed' && e.completed_at) completionDates[day] = e.completed_at;
  }
  return { ...block, recommendedDayIndex, dayIndex: recommendedDayIndex, completionDates, resolvedDays,
    todayCompleted: Object.values(completionDates).some(date => toBeijingDateKey(String(date)) === toBeijingDateKey(today)) };
}
