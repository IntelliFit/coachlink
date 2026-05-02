export function lambdaEpley(reps: number): number {
  if (reps <= 0) throw new Error('reps must be positive')
  return 1 + 0.0333 * reps
}

export function lambdaBrzycki(reps: number): number {
  if (reps <= 0 || reps >= 37) throw new Error('reps must be between 1 and 36')
  return 36 / (37 - reps)
}

export function lambdaAverage(reps: number): number {
  return (lambdaEpley(reps) + lambdaBrzycki(reps)) / 2
}

export type LambdaModel = 'average' | 'epley' | 'brzycki'

export function calcRecommendedLoad(
  oneRM: number,
  bodyWeight: number,
  reps: number,
  alpha = 1,
  model: LambdaModel = 'average'
): number {
  if (alpha !== 0 && bodyWeight <= 0) {
    throw new Error('bodyWeight must be positive when alpha is enabled')
  }

  let lambda = lambdaAverage(reps)
  if (model === 'epley') lambda = lambdaEpley(reps)
  if (model === 'brzycki') lambda = lambdaBrzycki(reps)

  const load = (oneRM + alpha * bodyWeight) / lambda - alpha * bodyWeight
  return Number(load.toFixed(1))
}

export function rmToPercentage(rm: number): number {
  if (rm <= 0) return 1
  if (rm >= 37) return 0.5
  return (37 - rm) / 36
}
