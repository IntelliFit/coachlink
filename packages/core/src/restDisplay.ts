/**
 * 组间休息：统一按「秒」存储（计划 params['休息时间'] / rest_seconds、执行 planned_rest_seconds），
 * 所有界面统一按「分钟」显示和输入（休息一般以分钟为单位）。
 * 倒计时本身（mm:ss）和计时器的 ±10 秒调节不在此列。
 */

/** 秒 → 分钟数值，最多两位小数（90 → 1.5，45 → 0.75）；无效值返回 null。 */
export function restSecondsToMinutes(seconds: unknown): number | null {
  if (seconds === null || seconds === undefined || seconds === '') return null
  const value = Number(seconds)
  if (!Number.isFinite(value) || value < 0) return null
  return Number((value / 60).toFixed(2))
}

/** 分钟 → 秒（整数）。 */
export function restMinutesToSeconds(minutes: unknown): number | null {
  if (minutes === null || minutes === undefined || minutes === '') return null
  const value = Number(minutes)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 60)
}

/** 「1.5分钟」；0 或无效返回空字符串，由调用方决定是否显示「无间歇」等文案。 */
export function formatRestMinutes(seconds: unknown): string {
  const minutes = restSecondsToMinutes(seconds)
  if (minutes === null || minutes <= 0) return ''
  return `${minutes}分钟`
}
