/** Shared by both clients and the API. A recorded workout must never be discarded. */
export function executionHasRecordedProgress(execution: any): boolean {
  if (Number(execution?.completed_sets || 0) > 0) return true
  if (String(execution?.session_notes || '').trim()) return true
  const actions = Array.isArray(execution?.action_executions) ? execution.action_executions : []
  return actions.some((action: any) => {
    if (Number(action?.completed_sets || 0) > 0) return true
    return (Array.isArray(action?.sets) ? action.sets : []).some((set: any) => {
      if (String(set?.status || 'pending').toLowerCase() !== 'pending') return true
      if (set?.is_pr || set?.is_auto_pr || set?.has_video) return true
      return [set?.actual_weight, set?.actual_reps, set?.rpe, set?.actual_distance,
        set?.actual_duration, set?.diet_content, set?.notes, set?.video_url]
        .some(value => value !== null && value !== undefined && String(value).trim() !== '')
    })
  })
}

export function canCancelEmptyPlanExecution(execution: any): boolean {
  return !!execution?.id && String(execution?.status || '').toLowerCase() === 'in_progress'
    && !executionHasRecordedProgress(execution)
}
