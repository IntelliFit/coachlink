import { getActualDurationSeconds, isTimedTrainingSet } from '@coachlink/core/src/trainingSetMetrics'
import { getSetDisplayWeight, weightUnitLabel } from '@coachlink/core/src/weightUnit'

/** Font sizes tried, largest first, before a poster set chip falls back to an ellipsis. */
export const POSTER_SET_FONT_SIZES = [18, 17, 16, 15, 14]

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatKg(value: number): string {
  return String(Number(Math.abs(value).toFixed(2)))
}

/**
 * Compact recorded-set text for the narrow chips on the share poster ("20kg×8", "30秒").
 * Uses actual values only, like formatRecordedTrainingSet, but without spaces or the "次" suffix
 * so weight and reps both stay visible.
 */
export function formatPosterSetText(set: any, action?: any): string {
  if (isTimedTrainingSet(set, action)) {
    const seconds = getActualDurationSeconds(set)
    return seconds === null ? '未记录' : `${seconds}秒`
  }
  const weight = finiteNumber(set?.actual_weight ?? set?.actualWeight)
  const reps = finiteNumber(set?.actual_reps ?? set?.actualReps)
  const shown = getSetDisplayWeight(set)
  const label = shown ? weightUnitLabel(shown.unit) : 'kg'
  const load = weight === null || !shown
    ? '—'
    : weight === 0
      ? '自重'
      : weight < 0
        ? `辅助${formatKg(shown.value)}${label}`
        : `${formatKg(shown.value)}${label}`
  return `${load}×${reps ?? '-'}`
}

/**
 * Picks the largest font size at which `text` fits `maxWidth`; only when even the smallest size
 * overflows is the text shortened with an ellipsis.
 */
export function fitPosterChipText(
  text: string,
  maxWidth: number,
  measure: (value: string, fontSize: number) => number,
  sizes: number[] = POSTER_SET_FONT_SIZES
): { text: string; fontSize: number } {
  const value = String(text || '')
  for (const fontSize of sizes) {
    if (measure(value, fontSize) <= maxWidth) return { text: value, fontSize }
  }
  const fontSize = sizes[sizes.length - 1]
  let current = value
  while (current.length > 1 && measure(`${current}…`, fontSize) > maxWidth) {
    current = current.slice(0, -1)
  }
  return { text: `${current}…`, fontSize }
}
