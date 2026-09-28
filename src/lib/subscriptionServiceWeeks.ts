import { getDayIndex, isTrainingDay, type TrainingDayLike, type ExecutionLike } from './subscriptionCredits';

export const SERVICE_WEEK_EPSILON = 1e-9;

/** A session consumes its share of its own original plan week (not a calendar week). */
export function computeConsumedServiceWeeks(params: {
  trainingDays: TrainingDayLike[]; executions: ExecutionLike[]; startExecutionDay?: number | null;
}) {
  const trainingByWeek = new Map<number, Set<number>>();
  for (const day of params.trainingDays) {
    const index = getDayIndex(day);
    if (!Number.isInteger(index) || index < 1 || !isTrainingDay(day)) continue;
    const week = Math.ceil(index / 7);
    const days = trainingByWeek.get(week) || new Set<number>();
    days.add(index);
    trainingByWeek.set(week, days);
  }
  const completed = new Set(params.executions.filter(e => e.status === 'completed').map(e => Number(e.day_index)));
  const start = Math.max(1, Number(params.startExecutionDay || 1));
  let consumed = 0;
  for (const days of trainingByWeek.values()) {
    const used = [...days].filter(index => index < start || completed.has(index)).length;
    consumed += used / days.size;
  }
  return consumed;
}
