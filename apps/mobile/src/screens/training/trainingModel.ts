export type NormalizedSet = {
  setIndex: number
  setNumber: number
  status: string
  plannedWeight?: string | number | null
  plannedReps?: string | number | null
  actualWeight?: string | number | null
  actualReps?: string | number | null
  rpe?: string | number | null
}

export type NormalizedActionExecution = {
  actionIndex: number
  actionId?: string
  actionName: string
  sets: NormalizedSet[]
}

export function pickData(payload: any) {
  if (payload?.data?.data) return payload.data.data
  if (payload?.data) return payload.data
  return payload
}

export function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export function normalizeExecution(raw: any) {
  const execution = raw?.execution || raw?.impromptu || raw
  const actions = Array.isArray(execution?.action_executions)
    ? execution.action_executions
    : Array.isArray(execution?.actions)
      ? execution.actions
      : []

  const normalizedActions: NormalizedActionExecution[] = actions.map((action: any, actionIndex: number) => {
    const actionDetail = action.action || action.action_detail || action.actionDetail || {}
    const actionName = action.action_name || action.actionName || action.name || actionDetail.name || `动作 ${actionIndex + 1}`
    const sets = Array.isArray(action.sets) ? action.sets : Array.isArray(action.set_executions) ? action.set_executions : []
    return {
      actionIndex,
      actionId: action.action_id || action.actionId || actionDetail.id,
      actionName,
      sets: sets.map((set: any, setIndex: number) => ({
        setIndex,
        setNumber: Number(set.set_number || set.setNumber || setIndex + 1),
        status: String(set.status || (set.completed ? 'completed' : 'pending')),
        plannedWeight: set.planned_weight ?? set.plannedWeight ?? set.weight ?? null,
        plannedReps: set.planned_reps ?? set.plannedReps ?? set.reps ?? null,
        actualWeight: set.actual_weight ?? set.actualWeight ?? null,
        actualReps: set.actual_reps ?? set.actualReps ?? null,
        rpe: set.rpe ?? null,
      })),
    }
  })

  return {
    ...execution,
    id: execution?.id || execution?.executionId,
    action_executions: normalizedActions,
    total_sets: Number(execution?.total_sets ?? execution?.totalSets ?? normalizedActions.reduce((sum, action) => sum + action.sets.length, 0)),
    completed_sets: Number(execution?.completed_sets ?? execution?.completedSets ?? normalizedActions.reduce((sum, action) => sum + action.sets.filter((set) => set.status === 'completed').length, 0)),
  }
}

export function parseNumberInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function displayLoad(weight?: string | number | null, reps?: string | number | null) {
  const w = weight === null || weight === undefined || weight === '' ? '-' : String(weight)
  const r = reps === null || reps === undefined || reps === '' ? '-' : String(reps)
  return `${w} x ${r}`
}
