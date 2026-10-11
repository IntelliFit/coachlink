import { normalizePlanDays } from './trainingAccess';
import { buildPlannedSetPreviews } from './planSetPrescriptions';

/** Display-only prescription. Its preview ID must never reach a mutation API. */
export function buildPlanExecutionPreview(instance: any, actions: Record<string, any>, dayIndex: number) {
  const day = normalizePlanDays(instance?.training_days || []).find(d => d.dayIndex === dayIndex);
  const action_executions = (day?.actionSets || []).map((set: any, index: number) => {
    const id = set.action_id || set.actionId;
    const action = actions[id] || {};
    const sets = buildPlannedSetPreviews(set);
    return { action_id: id, action_name: action.name || set.actionName || set.set_name || '动作',
      action_order: index + 1, source_action_index: index, item_type: set.itemType || action.type || 'STRENGTH',
      params: set.params || {}, custom_data: set.params?.custom_data || {},
      sets, total_sets: sets.length, completed_sets: 0 };
  });
  return { id: `preview-${instance?.id}-${dayIndex}`, status: 'preview', day_index: dayIndex,
    action_executions, total_sets: action_executions.reduce((n: number, a: any) => n + a.total_sets, 0), completed_sets: 0 };
}
