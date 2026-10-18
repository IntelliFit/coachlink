import { dayHasRestTasks } from './planProgress';

export type TrainingIntent = 'execute' | 'preview' | 'review';
export const planDayIndex = (day: any) => Number(day?.dayIndex ?? day?.day_index ?? 0);
export const normalizePlanDays = (days: any[]) => (days || []).map(day => ({
  ...day, dayIndex: planDayIndex(day), type: String(day?.type || 'training').toLowerCase(),
  actionSets: day?.actionSets ?? day?.action_sets ?? [],
})).filter(day => Number.isInteger(day.dayIndex) && day.dayIndex > 0).sort((a, b) => a.dayIndex - b.dayIndex);

/** Shared sequence rule; entitlement and ownership are always checked by the server. */
export function canStartPlanDay(params: {
  trainingDays: any[]; progressDayIndex: number; targetDayIndex: number;
  executionsByDayIndex?: Record<number, any>;
}) {
  const { progressDayIndex, targetDayIndex, executionsByDayIndex = {} } = params;
  const days = normalizePlanDays(params.trainingDays);
  const target = days.find(day => day.dayIndex === targetDayIndex);
  if (!target || targetDayIndex < progressDayIndex) return false;
  const hasWork = target.type === 'training' || dayHasRestTasks(target, executionsByDayIndex[targetDayIndex], {});
  if (!hasWork) return false;
  if (targetDayIndex === progressDayIndex) return true;
  return target.type === 'training' && days.some(day => day.dayIndex === progressDayIndex) &&
    days.filter(day => day.dayIndex >= progressDayIndex && day.dayIndex < targetDayIndex)
      .every(day => day.type !== 'training' && !dayHasRestTasks(day, executionsByDayIndex[day.dayIndex], {}));
}

export function trainingEntry(params: Parameters<typeof canStartPlanDay>[0] & { execution?: any }) {
  const status = String(params.execution?.status || '').toLowerCase();
  if (status === 'completed') return { intent: 'review' as TrainingIntent, label: '查看训练记录' };
  if (status === 'abandoned') return { intent: 'review' as TrainingIntent, label: '查看已跳过记录' };
  if (status === 'in_progress') return canStartPlanDay(params)
    ? { intent: 'execute' as TrainingIntent, label: '继续训练' }
    : { intent: 'preview' as TrainingIntent, label: '查看待处理记录' };
  if (canStartPlanDay(params)) return { intent: 'execute' as TrainingIntent, label: status === 'timed_out' ? '处理上次训练' : '开始训练' };
  return { intent: 'preview' as TrainingIntent, label: '查看计划' };
}

export function executionCapabilities(execution: any, intent: TrainingIntent, ready = true) {
  const rawStatus = String(execution?.status || '').toLowerCase();
  const status = rawStatus === 'finished' ? 'completed' : rawStatus;
  const persisted = !!execution?.id && !String(execution.id).startsWith('preview-') && status !== 'preview';
  const confirmed = ready && persisted;
  const viewing = intent === 'preview';
  return {
    canRecord: confirmed && !viewing && intent === 'execute' && status === 'in_progress',
    canCorrect: confirmed && !viewing && status === 'completed',
    canRecover: confirmed && !viewing && status === 'timed_out',
    isPreview: !persisted || viewing,
    status,
  };
}

/** Select the same attempt for display and resume. Progress uses separate facts. */
export function selectPlanAttempt(executions: any[]) {
  // A completed day cannot be reopened by an older/duplicate active attempt.
  const rank: Record<string, number> = { completed: 4, in_progress: 3, timed_out: 2, abandoned: 1 };
  return [...(executions || [])].sort((a, b) =>
    (rank[b.status] || 0) - (rank[a.status] || 0) ||
    new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime() ||
    String(b.id || '').localeCompare(String(a.id || '')))[0] || null;
}

/** Legacy readOnly URLs remain previews, never implicit permission to start. */
export function resolveTrainingIntent(intent: unknown, readOnly?: unknown): TrainingIntent {
  if (intent === 'execute' || intent === 'preview' || intent === 'review') return intent;
  return ['1', 'true'].includes(String(readOnly).toLowerCase()) ? 'preview' : 'execute';
}
