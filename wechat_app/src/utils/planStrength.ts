import type { PlanActionOption, PlanActionSet } from '@/types/plan'
import { calcRecommendedLoad, rmToPercentage } from './rmCalculator'

export interface PlanOneRMRecord {
  actionId?: string
  actionName?: string
  canonicalActionId?: string
  current1RM: number
}

export interface ParsedIntensityValue {
  mode: 'rm' | 'percentage' | 'fixed' | 'unknown'
  value: number | null
  raw: string
}

export interface StrengthControlValue {
  mode: 'rm' | 'percentage' | 'fixed'
  value: string
}

export interface StrengthPreviewResult {
  source: 'auto' | 'manual' | 'missing'
  value?: number | null
  unit?: string
  reason?: string
  basis?: string
}

const normalizeKey = (value?: string | null) => String(value || '').trim().toLowerCase()

const normalizeNumeric = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const parseIntensityValue = (rawValue: unknown, loadValue?: unknown): ParsedIntensityValue => {
  const raw = String(rawValue || '').trim()
  const normalized = raw.replace(/\s+/g, '').toUpperCase()

  const percentageMatch = normalized.match(/(-?\d+(?:\.\d+)?)%/)
  if (percentageMatch) {
    return {
      mode: 'percentage',
      value: Number(percentageMatch[1]),
      raw
    }
  }

  const rmMatch = normalized.match(/(-?\d+(?:\.\d+)?)RM/)
  if (rmMatch) {
    return {
      mode: 'rm',
      value: Number(rmMatch[1]),
      raw
    }
  }

  const fixedLoad = normalizeNumeric(loadValue)
  if (fixedLoad !== null && fixedLoad > 0) {
    return {
      mode: 'fixed',
      value: fixedLoad,
      raw
    }
  }

  return {
    mode: 'unknown',
    value: null,
    raw
  }
}

export const getStrengthControlValue = (rawValue: unknown, loadValue?: unknown): StrengthControlValue => {
  const parsed = parseIntensityValue(rawValue, loadValue)

  if (parsed.mode === 'fixed') {
    return {
      mode: 'fixed',
      value: parsed.value !== null ? String(parsed.value) : ''
    }
  }

  if (parsed.mode === 'percentage') {
    return {
      mode: 'percentage',
      value: parsed.value !== null ? String(parsed.value) : ''
    }
  }

  if (parsed.mode === 'rm') {
    return {
      mode: 'rm',
      value: parsed.value !== null ? String(parsed.value) : ''
    }
  }

  return {
    mode: 'rm',
    value: ''
  }
}

export const applyStrengthControlValue = (
  params: Record<string, any>,
  control: StrengthControlValue
) => {
  const nextParams = {
    ...params
  }
  const trimmed = String(control.value || '').trim()

  if (control.mode === 'fixed') {
    nextParams.intensity = ''
    nextParams.load = trimmed
    return nextParams
  }

  nextParams.load = ''

  if (!trimmed) {
    nextParams.intensity = ''
    return nextParams
  }

  nextParams.intensity = control.mode === 'percentage'
    ? `${trimmed}%`
    : `${trimmed}RM`

  return nextParams
}

export const buildOneRMIndex = (records?: PlanOneRMRecord[] | null) => {
  const map: Record<string, number> = {}
  ;(records || []).forEach((record) => {
    const value = Number(record?.current1RM)
    if (!Number.isFinite(value) || value <= 0) return

    const keys = [
      record?.actionId,
      record?.canonicalActionId,
      record?.actionName
    ]

    keys.forEach((key) => {
      const normalized = normalizeKey(key)
      if (normalized) map[normalized] = value
    })
  })
  return map
}

export const resolveReferenceOneRM = (
  action: PlanActionOption | undefined,
  planOneRMConfig: Record<string, number>,
  indexedRecords: Record<string, number>
) => {
  if (!action) return null

  const localValue = Number(planOneRMConfig[action.id] || 0)
  if (Number.isFinite(localValue) && localValue > 0) return localValue

  const keys = [
    action.id,
    action.canonical_action_id,
    action.name
  ]

  for (const key of keys) {
    const value = indexedRecords[normalizeKey(key)]
    if (Number.isFinite(value) && value > 0) return value
  }

  return null
}

export const isGenericDisplayName = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return true
  return /^动作\d+$/i.test(text)
}

export const resolveEditableDisplayName = (set: PlanActionSet) => {
  const customName = String(set.setName || set.set_name || '').trim()
  if (!customName || isGenericDisplayName(customName)) return ''

  const actionName = String(set.actionName || set.action_name || '').trim()
  if (customName === actionName) return ''

  return customName
}

export const isAutoLoadEligible = (action?: PlanActionOption | null) => {
  if (!action) return false
  const attrs = Array.isArray(action.attrs) ? action.attrs : []
  return Boolean(action.enableAutoWeightCompute || attrs.includes('强度'))
}

export const buildStrengthPreview = (params: Record<string, any>, options: {
  action?: PlanActionOption
  oneRM?: number | null
  bodyWeight?: number | null
}): StrengthPreviewResult => {
  const { action, oneRM, bodyWeight } = options
  const manualLoad = normalizeNumeric(params?.load)
  const parsedIntensity = parseIntensityValue(params?.intensity, manualLoad)

  if (parsedIntensity.mode === 'fixed' && manualLoad !== null && manualLoad > 0) {
    return {
      source: 'manual',
      value: Number(manualLoad.toFixed(1)),
      unit: 'kg',
      basis: '固定重量'
    }
  }

  if (!isAutoLoadEligible(action)) {
    if (manualLoad !== null && manualLoad > 0) {
      return {
        source: 'manual',
        value: Number(manualLoad.toFixed(1)),
        unit: 'kg',
        basis: '固定重量'
      }
    }
    return {
      source: 'missing',
      reason: '当前动作未启用自动算重'
    }
  }

  if (!Number.isFinite(oneRM as number) || Number(oneRM) <= 0) {
    return {
      source: 'missing',
      reason: '填写 1RM 后自动计算'
    }
  }

  if (parsedIntensity.mode === 'percentage' && parsedIntensity.value) {
    return {
      source: 'auto',
      value: Number((Number(oneRM) * (parsedIntensity.value / 100)).toFixed(1)),
      unit: 'kg',
      basis: `${parsedIntensity.value}% 1RM`
    }
  }

  if (parsedIntensity.mode === 'rm' && parsedIntensity.value) {
    const includesBodyWeight = Boolean(action?.includesBodyWeight)
    if (includesBodyWeight && (!Number.isFinite(bodyWeight as number) || Number(bodyWeight) <= 0)) {
      return {
        source: 'missing',
        reason: '缺少体重数据'
      }
    }

    const value = includesBodyWeight
      ? calcRecommendedLoad(Number(oneRM), Number(bodyWeight), parsedIntensity.value, 1, 'average')
      : Number((Number(oneRM) * rmToPercentage(parsedIntensity.value)).toFixed(1))

    return {
      source: 'auto',
      value,
      unit: 'kg',
      basis: `${parsedIntensity.value}RM`
    }
  }

  if (manualLoad !== null && manualLoad > 0) {
    return {
      source: 'manual',
      value: Number(manualLoad.toFixed(1)),
      unit: 'kg',
      basis: '固定重量'
    }
  }

  return {
    source: 'missing',
    reason: '填写强度后显示自动算重'
  }
}
