export type QuantizeMode = 'nearest' | 'floor' | 'ceil'

export function quantizeKgForGym(
  valueKg: number,
  incrementKg = 2.5,
  mode: QuantizeMode = 'nearest'
): number {
  if (!Number.isFinite(valueKg)) return valueKg
  if (!Number.isFinite(incrementKg) || incrementKg <= 0) return valueKg

  const steps = valueKg / incrementKg

  let quantizedSteps: number
  if (mode === 'floor') {
    quantizedSteps = valueKg >= 0 ? Math.floor(steps) : Math.ceil(steps)
  } else if (mode === 'ceil') {
    quantizedSteps = valueKg >= 0 ? Math.ceil(steps) : Math.floor(steps)
  } else {
    const absSteps = Math.abs(steps)
    quantizedSteps = Math.sign(valueKg) * Math.round(absSteps)
  }

  const quantized = quantizedSteps * incrementKg
  return Math.round(quantized * 100) / 100
}

export function formatKgValueForGym(
  valueKg: number,
  incrementKg = 2.5,
  mode: QuantizeMode = 'nearest'
): string {
  const q = quantizeKgForGym(valueKg, incrementKg, mode)
  if (!Number.isFinite(q)) return String(q)
  return q.toFixed(2).replace(/\.?0+$/, '')
}

export function formatKgForGym(
  valueKg: number,
  incrementKg = 2.5,
  mode: QuantizeMode = 'nearest'
): string {
  return `${formatKgValueForGym(valueKg, incrementKg, mode)}kg`
}
