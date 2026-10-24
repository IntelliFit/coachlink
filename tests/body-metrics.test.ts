import { describe, expect, it } from 'vitest'
import {
  buildProfileBodyMetricsPatch,
  parseRememberedBodyMetrics,
  readProfileBodyMetrics,
  readProfileGender,
  resolveBodyMetricsDefaults
} from '../packages/core/src/bodyMetrics'
import { normalizePowerAnalysisSubject } from '../packages/core/src/powerAnalysisModes'

describe('readProfileBodyMetrics', () => {
  it('reads height and weight from a user_profiles row', () => {
    expect(readProfileBodyMetrics({ height: 180, weight: 70 })).toEqual({ heightCm: 180, weightKg: 70 })
  })

  it('drops missing, zero and out-of-range values instead of guessing', () => {
    expect(readProfileBodyMetrics({ height: null, weight: 0 })).toEqual({ heightCm: null, weightKg: null })
    expect(readProfileBodyMetrics({ height: 18, weight: 700 })).toEqual({ heightCm: null, weightKg: null })
    expect(readProfileBodyMetrics(null)).toEqual({ heightCm: null, weightKg: null })
    expect(readProfileBodyMetrics({ height: '175', weight: 'abc' })).toEqual({ heightCm: 175, weightKg: null })
  })
})

describe('resolveBodyMetricsDefaults', () => {
  it('prefers the profile over values remembered on this device', () => {
    const result = resolveBodyMetricsDefaults(
      { heightCm: 180, weightKg: 70 },
      { heightCm: 170, weightKg: 65.5 }
    )
    expect(result).toEqual({ heightCm: '180', weightKg: '70', fromProfile: true })
  })

  it('falls back per field to the remembered value, then to empty (never a made-up default)', () => {
    expect(resolveBodyMetricsDefaults({ heightCm: 180, weightKg: null }, { heightCm: null, weightKg: 65.5 }))
      .toEqual({ heightCm: '180', weightKg: '65.5', fromProfile: false })
    expect(resolveBodyMetricsDefaults({ heightCm: null, weightKg: null }, null))
      .toEqual({ heightCm: '', weightKg: '', fromProfile: false })
  })
})

describe('buildProfileBodyMetricsPatch', () => {
  it('returns only the fields that differ from the profile, rounded to whole units', () => {
    expect(buildProfileBodyMetricsPatch({ heightCm: '180', weightKg: '72.4' }, { heightCm: 180, weightKg: 70 }))
      .toEqual({ weight: 72 })
    expect(buildProfileBodyMetricsPatch({ heightCm: '181.6', weightKg: '70' }, { heightCm: 180, weightKg: 70 }))
      .toEqual({ height: 182 })
  })

  it('returns null when nothing would change after rounding', () => {
    expect(buildProfileBodyMetricsPatch({ heightCm: '180', weightKg: '70.4' }, { heightCm: 180, weightKg: 70 })).toBeNull()
  })

  it('fills an empty profile and ignores invalid input', () => {
    expect(buildProfileBodyMetricsPatch({ heightCm: '178', weightKg: '68' }, { heightCm: null, weightKg: null }))
      .toEqual({ height: 178, weight: 68 })
    expect(buildProfileBodyMetricsPatch({ heightCm: '', weightKg: '20' }, { heightCm: null, weightKg: null })).toBeNull()
  })

  it('can patch weight alone for weight-only tools', () => {
    expect(buildProfileBodyMetricsPatch({ weightKg: '75' }, { heightCm: 180, weightKg: 70 })).toEqual({ weight: 75 })
  })
})

describe('parseRememberedBodyMetrics', () => {
  it('accepts a stored object or JSON string and validates ranges', () => {
    expect(parseRememberedBodyMetrics({ heightCm: 176, weightKg: 66.5 })).toEqual({ heightCm: 176, weightKg: 66.5 })
    expect(parseRememberedBodyMetrics('{"heightCm":176,"weightKg":999}')).toEqual({ heightCm: 176, weightKg: null })
  })

  it('returns null for garbage', () => {
    expect(parseRememberedBodyMetrics('not json')).toBeNull()
    expect(parseRememberedBodyMetrics(undefined)).toBeNull()
    expect(parseRememberedBodyMetrics({})).toBeNull()
  })
})

describe('readProfileGender', () => {
  it('maps stored values to male/female and leaves the rest unknown', () => {
    expect(readProfileGender({ gender: 'male' })).toBe('male')
    expect(readProfileGender({ gender: 'Female' })).toBe('female')
    expect(readProfileGender({ gender: 'other' })).toBeNull()
    expect(readProfileGender(null)).toBeNull()
  })
})

describe('normalizePowerAnalysisSubject', () => {
  it('defaults to measuring yourself', () => {
    expect(normalizePowerAnalysisSubject(undefined)).toBe('self')
    expect(normalizePowerAnalysisSubject('anything')).toBe('self')
    expect(normalizePowerAnalysisSubject('other')).toBe('other')
  })
})
