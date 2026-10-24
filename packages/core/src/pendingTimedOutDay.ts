import { getBeijingDateParts } from './beijingTime';

export type PendingTimedOutDay = {
  dayIndex: number;
  executionId: string;
  completedSets: number;
  totalSets: number;
  /** Beijing month/day the workout was started, e.g. "10月20日". */
  startedLabel: string | null;
  /** The recorded sets can be confirmed as they are; otherwise the day must be redone. */
  canConfirmRecorded: boolean;
};

/**
 * A workout that was never confirmed is closed by the 5-hour timeout and the
 * strict plan sequence then waits on that day. Surface it on the home screen
 * so the student can resolve it there instead of finding the plan "stuck".
 */
export function findPendingTimedOutDay(params: {
  executionsByDayIndex?: Record<number, any> | null;
  progressDayIndex?: number | null;
}): PendingTimedOutDay | null {
  const dayIndex = Number(params.progressDayIndex || 0);
  const execution = dayIndex > 0 ? params.executionsByDayIndex?.[dayIndex] : null;
  if (!execution?.id || String(execution.status || '').toLowerCase() !== 'timed_out') return null;
  const completedSets = Math.max(0, Number(execution.completed_sets || 0));
  const totalSets = Math.max(completedSets, Number(execution.total_sets || 0));
  const parts = execution.started_at ? getBeijingDateParts(execution.started_at) : null;
  return {
    dayIndex,
    executionId: String(execution.id),
    completedSets,
    totalSets,
    startedLabel: parts ? `${parts.month}月${parts.day}日` : null,
    canConfirmRecorded: completedSets > 0,
  };
}

export function describePendingTimedOutDay(pending: PendingTimedOutDay) {
  const when = pending.startedLabel ? `（${pending.startedLabel}）` : '';
  return {
    title: `第${pending.dayIndex}天${when}还没确认完成`,
    detail: pending.canConfirmRecorded
      ? `已记录 ${pending.completedSets}/${pending.totalSets} 组。确认后，后面的训练会继续显示。`
      : '这一天开始后没有记录内容，已自动结束。重新开始这一天即可继续。',
    confirmLabel: '按已记录内容补记完成',
    handleLabel: pending.canConfirmRecorded ? '去处理' : '重新开始',
  };
}
