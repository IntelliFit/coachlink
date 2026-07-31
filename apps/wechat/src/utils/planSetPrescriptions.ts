export interface PlannedSetPreview {
  set_number: number
  status: 'pending'
  planned_weight: string
  planned_reps: string
  planned_intensity: string
  planned_target_type?: string | null
  planned_target_unit?: string | null
  planned_rest_seconds?: number
}

function firstFiniteNumber(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveRestSeconds(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

function formatIntensityFromConfig(config: any): string {
  const relative = config?.relativeIntensity
  const value = firstFiniteNumber(relative?.value)
  if (value === null || value <= 0) return ''
  if (String(relative?.type).toLowerCase() === 'percentage') return `${value}%`
  if (String(relative?.type).toLowerCase() === 'rm') return `${value}RM`
  return ''
}

function formatPrescriptionIntensity(prescription: any): string {
  const explicit = String(prescription?.intensity || '').trim()
  if (explicit) return explicit

  const value = prescription?.intensityValue ?? prescription?.intensity_value
  const unit = String(prescription?.intensityUnit ?? prescription?.intensity_unit ?? '').trim()
  const normalizedUnit = unit.toLowerCase()
  const formattedValue = Array.isArray(value) ? value.join('–') : String(value ?? '').trim()
  if (!formattedValue) return ''
  if (normalizedUnit === '%' || normalizedUnit === 'percent' || normalizedUnit === 'percentage') {
    return `${formattedValue}%`
  }
  if (normalizedUnit === 'rpe' || normalizedUnit === 'rpe_range') {
    return `RPE ${formattedValue}`
  }
  return `${formattedValue}${unit ? ` ${unit}` : ''}`
}

function formatLegacyIntensity(actionSet: any, params: any): string {
  const configured = formatIntensityFromConfig(params?.intensityConfig)
  if (configured) return configured

  const raw = params?.['强度'] ?? params?.intensity ?? actionSet?.intensity
  const text = String(raw ?? '').trim()
  if (!text || text === '逐组见详情' || text === '按动作质量调整') return ''
  if (/^\d+(?:\.\d+)?$/.test(text)) return `${text}RM`
  return text
}

function formatFixedLoad(value: unknown): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed === 0) return ''
  const amount = String(Math.abs(parsed)).replace(/\.0+$/, '')
  return parsed < 0 ? `辅助${amount}kg` : `${amount}kg`
}

export function buildPlannedSetPreviews(actionSet: any): PlannedSetPreview[] {
  const params = actionSet?.params || {}
  const rawPrescriptions = params?.setPrescriptions ?? params?.set_prescriptions
  const prescriptions = Array.isArray(rawPrescriptions)
    ? rawPrescriptions.filter((item) => item && typeof item === 'object')
    : []
  const rawSetCount = Number(params?.['组数'] ?? params?.sets ?? actionSet?.sets ?? 1)
  const setCount = prescriptions.length > 0
    ? prescriptions.length
    : Number.isFinite(rawSetCount) && rawSetCount > 0
      ? Math.max(1, Math.floor(rawSetCount))
      : 1
  const defaultReps = String(params?.['次数'] ?? params?.reps ?? actionSet?.reps ?? '').trim()
  const defaultRest = positiveRestSeconds(
    params?.['休息时间'] ?? params?.rest_seconds ?? actionSet?.rest_seconds
  )
  const defaultLoad = formatFixedLoad(params?.load)
  const defaultIntensity = formatLegacyIntensity(actionSet, params)

  const itemType = String(actionSet?.itemType || actionSet?.item_type || 'STRENGTH').toUpperCase()
  if (itemType !== 'STRENGTH') {
    const repsValues = prescriptions.map((item) => String(item?.reps || '').trim()).filter(Boolean)
    const uniqueReps = [...new Set(repsValues)]
    const intensityValues = prescriptions.map(formatPrescriptionIntensity).filter(Boolean)
    const uniqueIntensities = [...new Set(intensityValues)]
    const rounds = prescriptions.length > 0 ? prescriptions.length : setCount
    return [{
      set_number: 1,
      status: 'pending',
      planned_weight: '',
      planned_reps: uniqueReps.length === 1 && rounds > 1
        ? `${rounds} × ${uniqueReps[0]}`
        : uniqueReps.length > 0
          ? uniqueReps.join(' / ')
          : defaultReps,
      planned_intensity: uniqueIntensities.length === 1
        ? uniqueIntensities[0]
        : uniqueIntensities.length > 1
          ? '逐组见详情'
          : defaultIntensity,
      planned_target_type: prescriptions[0]?.targetType ?? prescriptions[0]?.target_type ?? null,
      planned_target_unit: prescriptions[0]?.targetUnit ?? prescriptions[0]?.target_unit ?? null,
      planned_rest_seconds: positiveRestSeconds(
        prescriptions[0]?.restSeconds ?? prescriptions[0]?.rest_seconds
      ) ?? defaultRest
    }]
  }

  return Array.from({ length: setCount }).map((_, index) => {
    const prescription = prescriptions[index] || null
    return {
      set_number: index + 1,
      status: 'pending' as const,
      planned_weight: formatFixedLoad(prescription?.load) || defaultLoad,
      planned_reps: String(prescription?.reps ?? defaultReps).trim(),
      planned_intensity: prescription
        ? formatPrescriptionIntensity(prescription)
        : defaultIntensity,
      planned_target_type: prescription?.targetType ?? prescription?.target_type ?? null,
      planned_target_unit: prescription?.targetUnit ?? prescription?.target_unit ?? null,
      planned_rest_seconds: positiveRestSeconds(
        prescription?.restSeconds ?? prescription?.rest_seconds
      ) ?? defaultRest
    }
  })
}
