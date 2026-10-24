/**
 * "My body metrics" defaults shared by Web and the mini-program.
 *
 * Tools that need height/weight default to the signed-in user's own profile
 * (user_profiles.height / weight, whole cm / kg), then to what this device
 * remembered last time, and otherwise stay empty: a made-up default such as
 * 175 cm / 70 kg silently skews results for anyone who forgets to change it.
 */

export const BODY_HEIGHT_RANGE_CM = { min: 100, max: 250 } as const
export const BODY_WEIGHT_RANGE_KG = { min: 30, max: 250 } as const

/** Local fallback for users without a profile value; only ever holds the user's own numbers. */
export const MY_BODY_METRICS_STORAGE_KEY = 'coachlink:my-body-metrics:v1'

export interface BodyMetrics {
  heightCm: number | null
  weightKg: number | null
}

export interface BodyMetricsDefaults {
  heightCm: string
  weightKg: string
  /** Both values came from the profile, so the form can show them as a read-only line. */
  fromProfile: boolean
}

/** Fields for POST /api/user/update-profile (the profile stores whole numbers). */
export interface ProfileBodyMetricsPatch {
  height?: number
  weight?: number
}

type Range = { min: number; max: number }

const EMPTY_METRICS: BodyMetrics = { heightCm: null, weightKg: null }

function inRange(value: unknown, range: Range): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= range.min && n <= range.max ? n : null
}

function toInput(value: number | null): string {
  return value === null ? '' : String(value)
}

export function readProfileBodyMetrics(profile: unknown): BodyMetrics {
  if (!profile || typeof profile !== 'object') return EMPTY_METRICS
  const row = profile as { height?: unknown; weight?: unknown }
  return {
    heightCm: inRange(row.height, BODY_HEIGHT_RANGE_CM),
    weightKg: inRange(row.weight, BODY_WEIGHT_RANGE_KG)
  }
}

export function parseRememberedBodyMetrics(raw: unknown): BodyMetrics | null {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const row = value as { heightCm?: unknown; weightKg?: unknown }
  const metrics = {
    heightCm: inRange(row.heightCm, BODY_HEIGHT_RANGE_CM),
    weightKg: inRange(row.weightKg, BODY_WEIGHT_RANGE_KG)
  }
  return metrics.heightCm === null && metrics.weightKg === null ? null : metrics
}

/** Per field: profile first, then this device's remembered value, otherwise empty. */
export function resolveBodyMetricsDefaults(
  profile: BodyMetrics,
  remembered: BodyMetrics | null
): BodyMetricsDefaults {
  const heightCm = profile.heightCm ?? remembered?.heightCm ?? null
  const weightKg = profile.weightKg ?? remembered?.weightKg ?? null
  return {
    heightCm: toInput(heightCm),
    weightKg: toInput(weightKg),
    fromProfile: profile.heightCm !== null && profile.weightKg !== null
  }
}

/**
 * The profile update that would make the profile match what the user typed.
 * Only valid fields that differ after rounding are included; null means "nothing to save".
 */
export function buildProfileBodyMetricsPatch(
  input: { heightCm?: string | number | null; weightKg?: string | number | null },
  profile: BodyMetrics
): ProfileBodyMetricsPatch | null {
  const patch: ProfileBodyMetricsPatch = {}
  const height = inRange(input.heightCm, BODY_HEIGHT_RANGE_CM)
  const weight = inRange(input.weightKg, BODY_WEIGHT_RANGE_KG)
  if (height !== null && Math.round(height) !== profile.heightCm) patch.height = Math.round(height)
  if (weight !== null && Math.round(weight) !== profile.weightKg) patch.weight = Math.round(weight)
  return patch.height === undefined && patch.weight === undefined ? null : patch
}

/** Profile values after a successful patch, so the UI does not need to refetch. */
export function applyProfileBodyMetricsPatch(profile: BodyMetrics, patch: ProfileBodyMetricsPatch): BodyMetrics {
  return {
    heightCm: patch.height ?? profile.heightCm,
    weightKg: patch.weight ?? profile.weightKg
  }
}

/** Profile gender for formulas that need it; 'other' and unknown values return null. */
export function readProfileGender(profile: unknown): 'male' | 'female' | null {
  if (!profile || typeof profile !== 'object') return null
  const raw = String((profile as { gender?: unknown }).gender ?? '').trim().toLowerCase()
  if (raw === 'male' || raw === '男') return 'male'
  if (raw === 'female' || raw === '女') return 'female'
  return null
}

/** Keeps only valid values for the local fallback; returns null when there is nothing worth storing. */
export function toRememberedBodyMetrics(input: {
  heightCm?: string | number | null
  weightKg?: string | number | null
}): BodyMetrics | null {
  const metrics = {
    heightCm: inRange(input.heightCm, BODY_HEIGHT_RANGE_CM),
    weightKg: inRange(input.weightKg, BODY_WEIGHT_RANGE_KG)
  }
  return metrics.heightCm === null && metrics.weightKg === null ? null : metrics
}
