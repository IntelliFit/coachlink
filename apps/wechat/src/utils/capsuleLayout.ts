import Taro from '@tarojs/taro'

export interface CapsuleLayout {
  /** Distance from the top of the window to the capsule's top edge (px). */
  top: number
  /** Capsule height (px); the row that shares the capsule's line uses this height. */
  height: number
  /** Space to keep clear on the right so content never sits under the capsule (px). */
  rightReserve: number
}

const FALLBACK: CapsuleLayout = { top: 48, height: 32, rightReserve: 104 }

let cached: CapsuleLayout | null = null

/** Position of WeChat's top-right capsule, for pages with navigationStyle: 'custom'. */
export function getCapsuleLayout(): CapsuleLayout {
  if (cached) return cached
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    const { windowWidth } = Taro.getWindowInfo()
    if (rect?.top && rect.height && windowWidth) {
      cached = {
        top: rect.top,
        height: rect.height,
        rightReserve: Math.max(0, windowWidth - rect.left) + 8
      }
      return cached
    }
  } catch {
    // Fall back to typical iPhone values when the capsule API is unavailable (e.g. H5).
  }
  return FALLBACK
}
