import type { TodayTrainingCache, TodayTrainingPlanBlock } from './todayTrainingCache'

/**
 * 与小程序今日训练页一致：所有训练日都已完成、而计划仍是 active 时，
 * 由学员端调用 /api/plan-lib/complete-instance 收尾（会触发教练端下一阶段自动化）。
 */
export function isPlanReadyToComplete(block: TodayTrainingPlanBlock | null | undefined) {
  const instance = block?.instance
  if (!instance?.id || String(instance.status || '').toLowerCase() !== 'active') return false
  const total = Number(block?.totalTrainingDays || 0)
  const completed = Array.isArray(block?.completedDays) ? block.completedDays.length : 0
  return total > 0 && completed >= total
}

export function plansReadyToComplete(cache: TodayTrainingCache | null | undefined) {
  if (!cache) return []
  const blocks = [...Object.values(cache.coachPlanDataBySubId || {}), cache.selfPlanData]
  const seen = new Set<string>()
  return blocks
    .filter(isPlanReadyToComplete)
    .map((block) => block.instance)
    .filter((instance) => {
      const id = String(instance.id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
}
