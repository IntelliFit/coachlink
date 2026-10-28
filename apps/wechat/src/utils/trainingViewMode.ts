import Taro from '@tarojs/taro'
import { normalizeTrainingViewMode, type TrainingViewMode } from '@coachlink/core/src/trainingViewMode'
import { appStorageKey } from './appStorage'

/** 训练执行页「列表 / 卡片」偏好，按设备记住，所有训练共用。 */
const TRAINING_VIEW_MODE_KEY = appStorageKey('training-view-mode')

export function readTrainingViewMode(): TrainingViewMode {
  try {
    return normalizeTrainingViewMode(Taro.getStorageSync(TRAINING_VIEW_MODE_KEY))
  } catch {
    return normalizeTrainingViewMode(null)
  }
}

export function saveTrainingViewMode(mode: TrainingViewMode): void {
  try {
    Taro.setStorageSync(TRAINING_VIEW_MODE_KEY, mode)
  } catch (e) {
    console.warn('[trainingViewMode] save failed', e)
  }
}
