import {
  CameraCompositeRecorder,
  type CameraFrameCapture,
  type CompositeRecorderOptions
} from '../games/cameraCompositeRecorder'
import { createSoundTimeline, type GameSound } from '../happy-bird/birdSoundtrack'
import type { BeanGame, BeanEventType } from './beanModel'
import { drawBeanScene, type BeanSceneExtras } from './beanScene'

export type BeanReplayCapture = CameraFrameCapture & {
  extras: BeanSceneExtras
  game: BeanGame
}

const EVENT_SOUNDS: Partial<Record<BeanEventType, GameSound>> = {
  bad: { name: 'hit', volume: 1 },
  catch: { name: 'coin', volume: 0.7 },
  comboUp: { name: 'go', volume: 1 },
  countdownTick: { name: 'tick', volume: 1 },
  gameOver: { name: 'over', volume: 1 },
  go: { name: 'go', volume: 1 },
  gold: { name: 'perfect', volume: 1 },
  sprint: { name: 'surge', volume: 1 }
}

export function soundForBeanEvent(type: BeanEventType): GameSound | null {
  return EVENT_SOUNDS[type] || null
}

export class BeanRecorder extends CameraCompositeRecorder<BeanReplayCapture> {
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

  protected cloneCapture(capture: BeanReplayCapture): BeanReplayCapture {
    // BeanGame 每帧都是新对象；相机帧是页面专门留的一块缓冲区，不再复制第二次。
    return capture
  }

  protected drawOverlay(ctx: any, capture: BeanReplayCapture, width: number, height: number) {
    drawBeanScene(ctx, width, height, capture.game, capture.extras)
  }

  protected onFrameDrawn() {
    this.sounds.frameDrawn()
  }
}
