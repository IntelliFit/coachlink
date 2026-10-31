import type { ExerciseType } from './streetliftingCalculator'

/** 力量计算的云端历史和结果反馈，与小程序 calculator/history、calculator/result 一致。 */

export type CalcRecord = {
  id: string
  exerciseType: ExerciseType
  reps: number | null
  estimated1RMKg: number
  finalScore: number
  adjustedUsedWeightKg?: number | null
  resultLevel?: string | null
  createdAt: string
}

export type CalcRanking = {
  eligible: boolean
  bucketTitle?: string | null
  rank: number | null
  percentile: number | null
  totalParticipants: number
  notice?: string | null
}

export type CalcSummary = {
  latestRecord: CalcRecord | null
  previousRecord: CalcRecord | null
  personalBestRecord: CalcRecord | null
  deltaScore: number | null
  delta1RMKg: number | null
  ranking: CalcRanking
}

export const CALC_EXERCISE_CHIPS: Array<{ value: ExerciseType; label: string; title: string }> = [
  { value: 'weighted_pullup', label: '负重引体', title: '负重引体向上' },
  { value: 'weighted_dips', label: '负重臂屈伸', title: '负重双杠臂屈伸' },
  { value: 'strict_press', label: '实力推', title: '实力推（满分500）' },
  { value: 'barbell_curl', label: '杠铃弯举', title: '杠铃弯举（满分500）' },
  { value: 'squat', label: '深蹲', title: '深蹲（DOTS）' },
  { value: 'bench', label: '卧推', title: '卧推（DOTS）' },
  { value: 'deadlift', label: '硬拉', title: '硬拉（DOTS）' },
]

export function isCalcExerciseType(value: unknown): value is ExerciseType {
  return CALC_EXERCISE_CHIPS.some((option) => option.value === value)
}

/** 街健 500 分体系取整，其余保留 1 位。 */
export function calcScoreDecimals(exerciseType: ExerciseType) {
  return exerciseType === 'weighted_pullup' || exerciseType === 'weighted_dips' ? 0 : 1
}

export function formatCalcRecordScore(record: CalcRecord | null | undefined, exerciseType: ExerciseType) {
  return record ? record.finalScore.toFixed(calcScoreDecimals(exerciseType)) : '--'
}

export function formatCalcDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const beijing = new Date(date.getTime() + 8 * 3600 * 1000)
  return `${beijing.getUTCMonth() + 1}.${String(beijing.getUTCDate()).padStart(2, '0')} ${String(beijing.getUTCHours()).padStart(2, '0')}:${String(beijing.getUTCMinutes()).padStart(2, '0')}`
}

export function calcRankingText(summary: CalcSummary | null | undefined) {
  if (!summary?.ranking) return '暂无排名'
  if (!summary.ranking.eligible) return summary.ranking.notice || '当前模式暂不参与趣味排名'
  if (!summary.ranking.rank) return '暂无排名'
  return `第 ${summary.ranking.rank} 名 · 超过 ${summary.ranking.percentile ?? 0}% 用户`
}

export function calcRecordMeta(record: CalcRecord) {
  return [
    `1RM ${record.estimated1RMKg.toFixed(1)} kg`,
    record.reps ? `${record.reps} 次` : '',
    record.adjustedUsedWeightKg !== null && record.adjustedUsedWeightKg !== undefined ? `计算重量 ${record.adjustedUsedWeightKg.toFixed(1)} kg` : '',
  ].filter(Boolean).join(' · ')
}

/** 「较上次变化」；首条记录没有差值。 */
export function calcDeltaTexts(summary: CalcSummary, exerciseType: ExerciseType) {
  const signed = (value: number, digits: number) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
  return {
    score: summary.deltaScore === null || summary.deltaScore === undefined ? '--' : signed(summary.deltaScore, calcScoreDecimals(exerciseType)),
    oneRm: summary.delta1RMKg === null || summary.delta1RMKg === undefined ? '这是当前动作的首条记录' : `1RM ${signed(summary.delta1RMKg, 1)} kg`,
  }
}
