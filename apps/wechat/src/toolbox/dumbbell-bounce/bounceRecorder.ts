import {
  CameraCompositeRecorder,
  type CameraFrameCapture
} from '../games/cameraCompositeRecorder'
import { joltOffset, WORLD_WIDTH, type BounceScene } from './bounceModel'
import { drawBounceScene } from './bounceScene'

export type BounceReplayCapture = CameraFrameCapture & {
  scene: BounceScene
}

/** 竖屏 9:16，方便直接发抖音 / 小红书 / 视频号。 */
export const BOUNCE_REPLAY_WIDTH = 448
export const BOUNCE_REPLAY_HEIGHT = 800
export const BOUNCE_REPLAY_FPS = 20
/** 相机画面固定放大一点，撞击震动时不露边，和实时预览的 CSS 放大一致。 */
const BOUNCE_CAMERA_OVERSCAN = 1.04

export class DumbbellBounceRecorder extends CameraCompositeRecorder<BounceReplayCapture> {
  protected cloneCapture(capture: BounceReplayCapture): BounceReplayCapture {
    return {
      ...capture,
      frameBuffer: new Uint8ClampedArray(capture.frameBuffer),
      scene: { ...capture.scene }
    }
  }

  protected cameraTransform(capture: BounceReplayCapture, width: number) {
    const jolt = capture.scene.status === 'bouncing'
      ? joltOffset(capture.scene.sinceHit)
      : { x: 0, y: 0 }
    const pixels = width / WORLD_WIDTH
    return { scale: BOUNCE_CAMERA_OVERSCAN, x: jolt.x * pixels, y: jolt.y * pixels }
  }

  protected drawOverlay(ctx: any, capture: BounceReplayCapture, width: number, height: number) {
    drawBounceScene(ctx, width, height, capture.scene)
  }
}
