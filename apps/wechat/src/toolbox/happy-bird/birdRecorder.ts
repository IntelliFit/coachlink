import {
  CameraCompositeRecorder,
  type CameraFrameCapture
} from '../games/cameraCompositeRecorder'
import type { BirdGame } from './birdModel'
import { drawBirdScene, type BirdSceneExtras } from './birdScene'

export type BirdReplayCapture = CameraFrameCapture & {
  extras: BirdSceneExtras
  game: BirdGame
}

export class HappyBirdRecorder extends CameraCompositeRecorder<BirdReplayCapture> {
  protected cloneCapture(capture: BirdReplayCapture): BirdReplayCapture {
    // BirdGame 每帧都是新对象、不会被改，只有相机帧的缓冲区会被复用，需要拷贝。
    return { ...capture, frameBuffer: new Uint8ClampedArray(capture.frameBuffer) }
  }

  protected drawOverlay(ctx: any, capture: BirdReplayCapture, width: number, height: number) {
    drawBirdScene(ctx, width, height, capture.game, capture.extras)
  }
}
