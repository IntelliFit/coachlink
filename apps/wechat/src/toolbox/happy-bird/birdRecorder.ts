import {
  CameraCompositeRecorder,
  type CameraFrameCapture,
  type CompositeRecorderOptions
} from '../games/cameraCompositeRecorder'
import type { BirdGame } from './birdModel'
import { drawBirdScene, type BirdSceneExtras } from './birdScene'
import { createSoundTimeline, type GameSound } from './birdSoundtrack'

export type BirdReplayCapture = CameraFrameCapture & {
  extras: BirdSceneExtras
  game: BirdGame
}

export class HappyBirdRecorder extends CameraCompositeRecorder<BirdReplayCapture> {
  private readonly sounds: ReturnType<typeof createSoundTimeline>

  constructor(options: CompositeRecorderOptions & { fps: number }) {
    super(options)
    this.sounds = createSoundTimeline(options.fps)
  }

  noteSound(sound: GameSound) {
    this.sounds.noteSound(sound)
  }

  noteMusicStart() {
    this.sounds.noteMusicStart()
  }

  noteMusicStop() {
    this.sounds.noteMusicStop()
  }

  soundtrackPlan() {
    return this.sounds.plan()
  }

  protected cloneCapture(capture: BirdReplayCapture): BirdReplayCapture {
    // BirdGame 每帧都是新对象；相机帧是页面专门留的一块缓冲区，不再复制第二次（高清帧每帧近 4MB）。
    return capture
  }

  protected drawOverlay(ctx: any, capture: BirdReplayCapture, width: number, height: number) {
    drawBirdScene(ctx, width, height, capture.game, capture.extras)
  }

  protected onFrameDrawn() {
    this.sounds.frameDrawn()
  }
}
