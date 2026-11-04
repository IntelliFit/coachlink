import {
  CameraCompositeRecorder,
  type CameraFrameCapture
} from '../games/cameraCompositeRecorder'
import type { BounceScene } from './bounceModel'
import { drawBounceScene } from './bounceScene'

export type BounceReplayCapture = CameraFrameCapture & {
  scene: BounceScene
}

/** 竖屏 9:16，方便直接发抖音 / 小红书 / 视频号。 */
export const BOUNCE_REPLAY_WIDTH = 448
export const BOUNCE_REPLAY_HEIGHT = 800
export const BOUNCE_REPLAY_FPS = 20

export class DumbbellBounceRecorder extends CameraCompositeRecorder<BounceReplayCapture> {
  protected cloneCapture(capture: BounceReplayCapture): BounceReplayCapture {
    return {
      ...capture,
      frameBuffer: new Uint8ClampedArray(capture.frameBuffer),
      scene: { ...capture.scene }
    }
  }

  protected drawOverlay(ctx: any, capture: BounceReplayCapture, width: number, height: number) {
    drawBounceScene(ctx, width, height, capture.scene)
  }
}
