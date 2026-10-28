/** Training execution page layout: every action in one list, or one action per swipeable card. */
export type TrainingViewMode = 'list' | 'card'

export const DEFAULT_TRAINING_VIEW_MODE: TrainingViewMode = 'list'

export function normalizeTrainingViewMode(raw: unknown): TrainingViewMode {
  return typeof raw === 'string' && raw.trim() === 'card' ? 'card' : DEFAULT_TRAINING_VIEW_MODE
}

/** One-tap RPE choices on the set editor; tapping the selected value again clears it. */
export const RPE_QUICK_PICKS = [6, 7, 8, 9, 10] as const

export function toggleQuickRpe(current: number | null | undefined, picked: number): number | null {
  return current === picked ? null : picked
}
