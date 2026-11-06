/**
 * One Euro 滤波：静止时截止频率低、抖动被压住；动得快时截止频率随速度升高、几乎不拖后。
 * 固定比例的平滑只能在“稳”和“跟手”之间二选一，这个滤波两头都要。
 * 时间单位毫秒，数值单位随意（这里用 0–1 的画面坐标）。
 */

export type OneEuroOptions = {
  /** 静止时的截止频率（Hz），越小越稳。 */
  minCutoff: number
  /** 速度每增加 1 单位/秒，截止频率提高多少，越大越跟手。 */
  beta: number
  /** 估计速度时用的截止频率（Hz）。 */
  derivativeCutoff: number
}

/** 调到画面坐标：静止时压住约 0.5% 画面的抖动，抬头低头这种速度下延迟只剩几十毫秒。 */
export const HEAD_ONE_EURO: OneEuroOptions = { beta: 8, derivativeCutoff: 1, minCutoff: 1.2 }

/** 两次数据隔得太久（丢脸后重新识别到）就不平滑，直接跳到新位置。 */
const MAX_GAP_MS = 500

function smoothingFactor(cutoffHz: number, dtSeconds: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

export function createOneEuroFilter(options: OneEuroOptions = HEAD_ONE_EURO) {
  let last: { at: number; derivative: number; value: number } | null = null

  return {
    filter(value: number, at: number) {
      const dtMs = last ? at - last.at : 0
      if (!last || dtMs <= 0 || dtMs > MAX_GAP_MS) {
        last = { at, derivative: 0, value }
        return value
      }
      const dt = dtMs / 1000
      const rawDerivative = (value - last.value) / dt
      const derivativeAlpha = smoothingFactor(options.derivativeCutoff, dt)
      const derivative = last.derivative + derivativeAlpha * (rawDerivative - last.derivative)
      const cutoff = options.minCutoff + options.beta * Math.abs(derivative)
      const alpha = smoothingFactor(cutoff, dt)
      const filtered = last.value + alpha * (value - last.value)
      last = { at, derivative, value: filtered }
      return filtered
    },
    reset() {
      last = null
    }
  }
}
