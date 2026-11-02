export const BIRD_REPLAY_FPS = 20
export const BIRD_REPLAY_MAX_SECONDS = 300

export type BirdReplayQuality = {
  cameraFrameSize: 'large' | 'medium'
  cameraResolution: 'high' | 'medium'
  /** kbps */
  videoBitsPerSecond: number
  width: number
}

/**
 * 默认高清。清晰度的上限在相机帧：中等帧约 480 宽，裁成竖屏后真实宽度只剩 330 左右，
 * 只调大录制画布只会把模糊的画面放大，所以相机帧要一起提高。
 */
export const HIGH_REPLAY_QUALITY: BirdReplayQuality = {
  cameraFrameSize: 'large',
  cameraResolution: 'high',
  videoBitsPerSecond: 5000,
  width: 720
}

export const STANDARD_REPLAY_QUALITY: BirdReplayQuality = {
  cameraFrameSize: 'medium',
  cameraResolution: 'medium',
  videoBitsPerSecond: 3000,
  width: 540
}

/** 微信的设备性能分 1–50，低于这个值的手机同时跑识别、游戏和高清录制会卡。 */
const MIN_BENCHMARK_FOR_HIGH = 22

/** 拿不到性能分（-1、0 或没有）时按高清走，用户要的是默认高画质。 */
export function chooseReplayQuality(benchmarkLevel?: number) {
  const known = typeof benchmarkLevel === 'number' && benchmarkLevel > 0
  return known && benchmarkLevel < MIN_BENCHMARK_FOR_HIGH ? STANDARD_REPLAY_QUALITY : HIGH_REPLAY_QUALITY
}

const MIN_ASPECT = 1.5
const MAX_ASPECT = 2.2

/** 录制画布和页面舞台同比例，脸、小鸟、障碍的相对位置才和玩的时候一模一样。 */
export function replayHeightFor(stageWidth: number, stageHeight: number, replayWidth: number) {
  const aspect = stageWidth > 0 && stageHeight > 0 ? stageHeight / stageWidth : 16 / 9
  const clamped = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect))
  // 视频编码器要求 16 的倍数时兼容性最好。
  return Math.round((replayWidth * clamped) / 16) * 16
}
