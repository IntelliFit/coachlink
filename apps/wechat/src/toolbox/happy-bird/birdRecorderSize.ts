export const BIRD_REPLAY_WIDTH = 448
export const BIRD_REPLAY_FPS = 20
export const BIRD_REPLAY_MAX_SECONDS = 300

const MIN_ASPECT = 1.5
const MAX_ASPECT = 2.2

/** 录制画布和页面舞台同比例，脸、小鸟、障碍的相对位置才和玩的时候一模一样。 */
export function replayHeightFor(stageWidth: number, stageHeight: number) {
  const aspect = stageWidth > 0 && stageHeight > 0 ? stageHeight / stageWidth : 16 / 9
  const clamped = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect))
  // 视频编码器要求 16 的倍数时兼容性最好。
  return Math.round((BIRD_REPLAY_WIDTH * clamped) / 16) * 16
}
