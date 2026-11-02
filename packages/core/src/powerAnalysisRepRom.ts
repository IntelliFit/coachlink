/**
 * Per-rep range-of-motion grade the analyzer writes for pull-ups and muscle-ups
 * (scripts/power-analysis/rep_rom.py). Web and mini-program show the same words from here.
 */
export type PowerAnalysisRepGrade = 'full' | 'partial'

export interface PowerAnalysisRepRom {
  grade: PowerAnalysisRepGrade
  bottomElbowDeg: number | null
  topElbowDeg: number | null
  /** Above the cutoff when positive, short of it when negative, so the sign matches the grade. */
  clearanceMarginCm: number | null
  /** An end the landmarks could not show; it counts as not reached and reasonZh says so. */
  unreadable: boolean
  reasonZh: string
}

export interface PowerAnalysisRomSummary {
  fullReps: number
  partialReps: number
  unreadableReps: number
}

export const POWER_ANALYSIS_ROM_NOTE =
  '完整＝底部手臂伸直且顶部过杠，每次按这一次自己的最低点和最高点判断；看不清的一端按未达标算。半程目前仍计入次数和成绩，幅度明显过小的除外。'

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeRepRom(value: unknown): PowerAnalysisRepRom | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  if (raw.grade !== 'full' && raw.grade !== 'partial') return undefined
  return {
    grade: raw.grade,
    bottomElbowDeg: numberOrNull(raw.bottomElbowDeg),
    topElbowDeg: numberOrNull(raw.topElbowDeg),
    clearanceMarginCm: numberOrNull(raw.clearanceMarginCm),
    unreadable: raw.unreadable === true,
    reasonZh: typeof raw.reasonZh === 'string' ? raw.reasonZh : '',
  }
}

export function normalizeRomSummary(value: unknown): PowerAnalysisRomSummary | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const fullReps = numberOrNull(raw.fullReps)
  const partialReps = numberOrNull(raw.partialReps)
  if (fullReps === null || partialReps === null) return undefined
  return { fullReps, partialReps, unreadableReps: numberOrNull(raw.unreadableReps) ?? 0 }
}

export function repRomGradeLabel(rom: Pick<PowerAnalysisRepRom, 'grade'>): string {
  return rom.grade === 'full' ? '完整' : '半程'
}

function degrees(label: string, value: number | null): string {
  return value === null ? `${label}看不清` : `${label} ${Math.round(value)}°`
}

function margin(value: number | null): string {
  if (value === null) return '过杠余量看不清'
  const rounded = Math.round(value)
  return `过杠余量 ${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)} cm`
}

/** "底部肘角 172° · 过杠余量 +2 cm"; muscle-ups also show the lockout angle, which they are graded on. */
export function repRomDetail(rom: PowerAnalysisRepRom, mode: unknown): string {
  const parts = [degrees('底部肘角', rom.bottomElbowDeg)]
  if (mode === 'muscleup') parts.push(degrees('顶部肘角', rom.topElbowDeg))
  parts.push(margin(rom.clearanceMarginCm))
  return parts.join(' · ')
}

export function romSummaryText(summary: PowerAnalysisRomSummary): string {
  const unreadable = summary.unreadableReps > 0 ? `（其中 ${summary.unreadableReps} 次看不清）` : ''
  return `完整 ${summary.fullReps} 次 · 半程 ${summary.partialReps} 次${unreadable}`
}
