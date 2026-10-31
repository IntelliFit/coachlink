/**
 * 本次教练要求（计划里这个动作的 params.note），与小程序 training-execution getPlanActionNote 一致：
 * 优先按执行记录里的 source_action_index 找计划动作，找不到再按动作 ID 匹配。
 */
export function planActionCoachNote(trainingDays: any[] | null | undefined, dayIndex: number, action: any, actionIndex: number): string {
  const embedded = String(action?.planNote ?? action?.plan_note ?? '').trim()
  if (embedded) return embedded
  const days = Array.isArray(trainingDays) ? trainingDays : []
  const day = days.find((item: any) => Number(item?.dayIndex ?? item?.day_index) === Number(dayIndex))
  const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : Array.isArray(day?.action_sets) ? day.action_sets : []
  const sourceIndex = Number(action?.sourceActionIndex ?? action?.source_action_index)
  const preferredIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : actionIndex
  const actionId = String(action?.actionId ?? action?.action_id ?? '').trim()
  const indexed = actionSets[preferredIndex]
  const matched = indexed || actionSets.find((item: any) => actionId && String(item?.action_id || item?.actionId || '').trim() === actionId)
  return String(matched?.params?.note || matched?.note || '').trim()
}
