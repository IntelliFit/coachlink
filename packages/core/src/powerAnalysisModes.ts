/**
 * Movement catalog for the power/motion video analyzer. Web, mini-program and
 * API validation read this list so a new movement only needs adding here and
 * in the Python worker presets.
 */
export type PowerAnalysisBodyMode = 'pullup' | 'muscleup' | 'dip' | 'pushup' | 'squat'
export type PowerAnalysisBarbellMode = 'back_squat' | 'bench_press' | 'deadlift'
export type PowerAnalysisMode = PowerAnalysisBodyMode | PowerAnalysisBarbellMode

export interface PowerAnalysisModeOption {
  value: PowerAnalysisMode
  label: string
  hint: string
  barbell: boolean
}

export const POWER_ANALYSIS_MODE_OPTIONS: PowerAnalysisModeOption[] = [
  { value: 'pullup', label: '引体向上', hint: '正面或侧前方，全身入镜', barbell: false },
  { value: 'muscleup', label: '双力臂', hint: '保留过杠阶段，避免遮挡', barbell: false },
  { value: 'dip', label: '双杠臂屈伸', hint: '侧面或侧前方，肩肘清楚', barbell: false },
  { value: 'pushup', label: '俯卧撑', hint: '侧面拍摄，肩髋踝都要清楚', barbell: false },
  { value: 'squat', label: '深蹲起身', hint: '侧前方全身，髋部可见', barbell: false },
  { value: 'back_squat', label: '杠铃深蹲', hint: '侧面拍摄，近侧杠铃片完整入镜', barbell: true },
  { value: 'bench_press', label: '卧推', hint: '侧面拍摄，近侧杠铃片完整入镜', barbell: true },
  { value: 'deadlift', label: '硬拉', hint: '侧面拍摄，近侧杠铃片完整入镜', barbell: true }
]

export const POWER_ANALYSIS_MODES: PowerAnalysisMode[] = POWER_ANALYSIS_MODE_OPTIONS.map((item) => item.value)

/** Extra load on a bodyweight movement (belt, vest). */
export const POWER_ANALYSIS_EXTERNAL_LOAD_RANGE_KG = { min: 0, max: 250 } as const
/** Total barbell mass: bar, plates and collars. */
export const POWER_ANALYSIS_BARBELL_MASS_RANGE_KG = { min: 5, max: 500 } as const
export const POWER_ANALYSIS_PLATE_DIAMETER_RANGE_CM = { min: 20, max: 50 } as const
export const POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM = 45
export const POWER_ANALYSIS_DEFAULT_BARBELL_MASS_KG = 60

export const POWER_ANALYSIS_BARBELL_SHOOTING_TIP =
  '三大项请侧面拍摄，手机固定在髋部高度，近侧杠铃片完整入镜；系统会自动识别杠铃片来测速。'

export function normalizePowerAnalysisMode(value: unknown): PowerAnalysisMode | null {
  const mode = String(value ?? '').trim().toLowerCase()
  return POWER_ANALYSIS_MODES.includes(mode as PowerAnalysisMode) ? (mode as PowerAnalysisMode) : null
}

export function isBarbellPowerAnalysisMode(mode: unknown): mode is PowerAnalysisBarbellMode {
  return POWER_ANALYSIS_MODE_OPTIONS.some((item) => item.value === mode && item.barbell)
}

export function getPowerAnalysisModeLabel(mode: unknown): string {
  return POWER_ANALYSIS_MODE_OPTIONS.find((item) => item.value === mode)?.label ?? '引体向上'
}

/** Load field range: barbell lifts take the total bar mass, others an optional extra load. */
export function getPowerAnalysisLoadRangeKg(mode: unknown) {
  return isBarbellPowerAnalysisMode(mode)
    ? POWER_ANALYSIS_BARBELL_MASS_RANGE_KG
    : POWER_ANALYSIS_EXTERNAL_LOAD_RANGE_KG
}

export function isValidPowerAnalysisLoadKg(mode: unknown, value: unknown): boolean {
  const n = Number(value)
  const range = getPowerAnalysisLoadRangeKg(mode)
  return Number.isFinite(n) && n >= range.min && n <= range.max
}

export type PowerAnalysisLoadInput =
  | { ok: true; externalLoadKg: number; plateDiameterCm: number | null }
  | { ok: false; message: string }

/** Server-side check of the load fields for one movement. */
export function parsePowerAnalysisLoadInput(
  mode: PowerAnalysisMode,
  externalLoadKg: unknown,
  plateDiameterCm: unknown
): PowerAnalysisLoadInput {
  const range = getPowerAnalysisLoadRangeKg(mode)
  if (!isBarbellPowerAnalysisMode(mode)) {
    const load = Number(externalLoadKg ?? 0)
    return isValidPowerAnalysisLoadKg(mode, load)
      ? { ok: true, externalLoadKg: load, plateDiameterCm: null }
      : { ok: false, message: `额外负重需在 ${range.min}～${range.max} kg 之间` }
  }
  const barMass = Number(externalLoadKg)
  if (!isValidPowerAnalysisLoadKg(mode, barMass)) {
    return { ok: false, message: `请填写杠铃总重（杠铃杆加杠铃片），范围 ${range.min}～${range.max} kg` }
  }
  const diameter = plateDiameterCm === undefined || plateDiameterCm === null || plateDiameterCm === ''
    ? POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM
    : Number(plateDiameterCm)
  if (!isValidPlateDiameterCm(diameter)) {
    const { min, max } = POWER_ANALYSIS_PLATE_DIAMETER_RANGE_CM
    return { ok: false, message: `杠铃片直径需在 ${min}～${max} cm 之间` }
  }
  return { ok: true, externalLoadKg: barMass, plateDiameterCm: diameter }
}

export function isValidPlateDiameterCm(value: unknown): boolean {
  const n = Number(value)
  return (
    Number.isFinite(n) &&
    n >= POWER_ANALYSIS_PLATE_DIAMETER_RANGE_CM.min &&
    n <= POWER_ANALYSIS_PLATE_DIAMETER_RANGE_CM.max
  )
}
