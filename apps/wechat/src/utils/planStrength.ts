import type { PlanActionOption, PlanActionSet } from '@/types/plan'
import { calcRecommendedLoad } from './rmCalculator'

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
  unit?: 'kg' | 'lbs'
  reason?: string
  basis?: string
}

const normalizeKey = (value?: string | null) => String(value || '').trim().toLowerCase()

const normalizeNumeric = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const parseIntensityValue = (rawValue: unknown, loadValue?: unknown): ParsedIntensityValue => {
  const configRelative = (rawValue as any)?.relativeIntensity
  if (configRelative && typeof configRelative === 'object') {
    const configType = String(configRelative.type || '').trim().toLowerCase()
    const configValue = normalizeNumeric(configRelative.value)
    if (configType === 'percentage' && configValue !== null && configValue > 0) {
      return {
        mode: 'percentage',
        value: configValue,
        raw: `${configValue}%`
      }
    }
    if (configType === 'rm' && configValue !== null && configValue > 0) {
      return {
        mode: 'rm',
        value: configValue,
        raw: `${configValue}RM`
      }
    }
  }

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

  const directNumber = normalizeNumeric(rawValue)
  if (directNumber !== null && directNumber > 0) {
    return {
      mode: 'rm',
      value: directNumber,
      raw: `${directNumber}RM`
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
  const existingConfig = (params?.intensityConfig && typeof params.intensityConfig === 'object')
    ? params.intensityConfig
    : {}
  const nextConfig: Record<string, any> = {
    ...existingConfig
  }
  const currentLoad = normalizeNumeric(params?.load)
  const currentLoadUnit = String(params?.loadUnit || 'kg') === 'lbs' ? 'lbs' : 'kg'

  if (control.mode === 'fixed') {
    const fixedLoad = normalizeNumeric(trimmed)
    nextParams.intensity = ''
    nextParams['强度'] = undefined
    if (fixedLoad !== null && fixedLoad > 0) {
      nextParams.load = fixedLoad
      nextConfig.recommendedLoad = {
        value: fixedLoad,
        unit: currentLoadUnit
      }
    } else if (currentLoad !== null && currentLoad > 0) {
      nextConfig.recommendedLoad = {
        value: currentLoad,
        unit: currentLoadUnit
      }
    } else {
      delete nextConfig.recommendedLoad
    }
    delete nextConfig.relativeIntensity
    nextParams.intensityConfig = Object.keys(nextConfig).length > 0 ? nextConfig : undefined
    return nextParams
  }

  if (!trimmed) {
    nextParams.intensity = ''
    nextParams['强度'] = undefined
    delete nextConfig.relativeIntensity
    if (currentLoad !== null && currentLoad > 0) {
      nextConfig.recommendedLoad = {
        value: currentLoad,
        unit: currentLoadUnit
      }
    } else {
      delete nextConfig.recommendedLoad
    }
    nextParams.intensityConfig = Object.keys(nextConfig).length > 0 ? nextConfig : undefined
    return nextParams
  }

  const intensityNumber = normalizeNumeric(trimmed)
  if (control.mode === 'percentage') {
    nextParams.intensity = `${trimmed}%`
    nextParams['强度'] = undefined
    if (intensityNumber !== null && intensityNumber > 0) {
      nextConfig.relativeIntensity = {
        type: 'percentage',
        value: intensityNumber
      }
    } else {
      delete nextConfig.relativeIntensity
    }
  } else {
    nextParams.intensity = `${trimmed}RM`
    nextParams['强度'] = intensityNumber !== null && intensityNumber > 0 ? intensityNumber : undefined
    if (intensityNumber !== null && intensityNumber > 0) {
      nextConfig.relativeIntensity = {
        type: 'rm',
        value: intensityNumber
      }
    } else {
      delete nextConfig.relativeIntensity
    }
  }

  if (currentLoad !== null && currentLoad > 0) {
    nextConfig.recommendedLoad = {
      value: currentLoad,
      unit: currentLoadUnit
    }
  } else {
    delete nextConfig.recommendedLoad
  }
  nextParams.intensityConfig = Object.keys(nextConfig).length > 0 ? nextConfig : undefined

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
  const recommendedLoad = normalizeNumeric(params?.intensityConfig?.recommendedLoad?.value)
  const loadUnit: 'kg' | 'lbs' = String(params?.loadUnit || params?.intensityConfig?.recommendedLoad?.unit || 'kg') === 'lbs' ? 'lbs' : 'kg'
  const fallbackLoad = manualLoad !== null && manualLoad > 0
    ? manualLoad
    : (recommendedLoad !== null && recommendedLoad > 0 ? recommendedLoad : null)
  const relativeConfig = params?.intensityConfig?.relativeIntensity
  const legacyRm = normalizeNumeric(params?.['强度'])
  const intensityRaw = (relativeConfig && typeof relativeConfig === 'object')
    ? relativeConfig
    : (params?.intensity ?? legacyRm)
  const parsedIntensity = parseIntensityValue(intensityRaw, fallbackLoad)
  const algorithm = String(params?.algorithm || '综合计算')
  const modelMap = {
    Epley: 'epley',
    Brzycki: 'brzycki',
    Lombardi: 'lombardi',
    综合计算: 'average'
  } as const
  const lambdaModel = modelMap[algorithm as keyof typeof modelMap] || 'average'

  if (parsedIntensity.mode === 'fixed' && fallbackLoad !== null && fallbackLoad > 0) {
    return {
      source: 'manual',
      value: Number(fallbackLoad.toFixed(1)),
      unit: loadUnit,
      basis: '固定重量'
    }
  }

  if (!isAutoLoadEligible(action)) {
    if (fallbackLoad !== null && fallbackLoad > 0) {
      return {
        source: 'manual',
        value: Number(fallbackLoad.toFixed(1)),
        unit: loadUnit,
        basis: recommendedLoad !== null && recommendedLoad > 0 ? '推荐数值' : '固定重量'
      }
    }
    return {
      source: 'missing',
      reason: '当前动作未启用自动算重'
    }
  }

  if (!Number.isFinite(oneRM as number) || Number(oneRM) === 0) {
    if (fallbackLoad !== null && fallbackLoad > 0) {
      return {
        source: 'manual',
        value: Number(fallbackLoad.toFixed(1)),
        unit: loadUnit,
        basis: '推荐数值'
      }
    }
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

    if (parsedIntensity.value <= 0 || parsedIntensity.value >= 37) {
      return {
        source: 'missing',
        reason: 'RM 需在 1-36'
      }
    }

    const value = includesBodyWeight
      ? calcRecommendedLoad(Number(oneRM), Number(bodyWeight), parsedIntensity.value, 1, lambdaModel)
      : calcRecommendedLoad(Number(oneRM), 0, parsedIntensity.value, 0, lambdaModel)

    return {
      source: 'auto',
      value,
      unit: 'kg',
      basis: `${parsedIntensity.value}RM${algorithm ? ` · ${algorithm}` : ''}`
    }
  }

  if (fallbackLoad !== null && fallbackLoad > 0) {
    return {
      source: 'manual',
      value: Number(fallbackLoad.toFixed(1)),
      unit: loadUnit,
      basis: recommendedLoad !== null && recommendedLoad > 0 ? '推荐数值' : '固定重量'
    }
  }

  return {
    source: 'missing',
    reason: '填写强度后显示自动算重'
  }
}
