import Taro from '@tarojs/taro'
import { MUSIC_VOLUME } from './birdSoundtrack'
import { renderMusic, renderSfx, SFX_NAMES, type SfxName } from './birdSynth'

declare const wx: any

// 版本号写在目录名里：改了音色只要升版本，就会重新生成，旧目录留着也只占几百 KB。
const AUDIO_DIR = 'happy-bird-audio-v1'
const MUSIC_FILE = 'music.wav'

function pathExists(fileSystem: any, path: string) {
  return new Promise<boolean>((resolve) => {
    fileSystem.access({ path, success: () => resolve(true), fail: () => resolve(false) })
  })
}

function makeDirectory(fileSystem: any, path: string) {
  return new Promise<void>((resolve) => {
    fileSystem.mkdir({ dirPath: path, recursive: true, success: () => resolve(), fail: () => resolve() })
  })
}

function writeBinary(fileSystem: any, path: string, data: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    fileSystem.writeFile({ data, filePath: path, success: () => resolve(), fail: reject })
  })
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * 声音只是加分项：任何一步失败都只记日志，游戏照常玩。
 * 每种音效一个常驻播放器，微信对同时存在的播放器数量有限制，总数控制在 10 个以内。
 */
export class BirdAudio {
  private contexts = new Map<SfxName, any>()
  private destroyed = false
  private enabled: boolean
  private music: any = null
  private musicWanted = false

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  async prepare() {
    try {
      void (Taro as any).setInnerAudioOption?.({ mixWithOther: true })
      const fileSystem = Taro.getFileSystemManager()
      const directory = `${wx.env.USER_DATA_PATH}/${AUDIO_DIR}`
      await makeDirectory(fileSystem, directory)
      for (const name of SFX_NAMES) {
        if (this.destroyed) return
        const path = `${directory}/${name}.wav`
        if (!(await pathExists(fileSystem, path))) {
          await nextTask()
          await writeBinary(fileSystem, path, renderSfx(name))
        }
        // 短音效开 WebAudio 驱动，延迟更低；长的背景音乐不开，省内存。
        this.contexts.set(name, this.createPlayer(path, true))
      }
      await this.prepareMusic(fileSystem, `${directory}/${MUSIC_FILE}`)
    } catch (error) {
      console.warn('快乐小鸟音效准备失败，本次静音:', error)
    }
  }

  play(name: SfxName, volume = 1) {
    if (!this.enabled) return
    const context = this.contexts.get(name)
    if (!context) return
    try {
      context.volume = volume
      context.stop()
      context.play()
    } catch (error) {
      console.warn('快乐小鸟音效播放失败:', error)
    }
  }

  startMusic() {
    this.musicWanted = true
    if (this.enabled) this.music?.play()
  }

  stopMusic() {
    this.musicWanted = false
    this.music?.stop()
  }

  /** 切后台时暂停，回来后按原来的意图恢复。 */
  suspend() {
    this.music?.pause()
  }

  resume() {
    if (this.enabled && this.musicWanted) this.music?.play()
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled) this.resume()
    else this.suspend()
  }

  destroy() {
    this.destroyed = true
    this.contexts.forEach((context) => context.destroy())
    this.contexts.clear()
    this.music?.destroy()
    this.music = null
  }

  private async prepareMusic(fileSystem: any, path: string) {
    if (this.destroyed) return
    if (!(await pathExists(fileSystem, path))) {
      await nextTask()
      await writeBinary(fileSystem, path, renderMusic())
    }
    if (this.destroyed) return
    const music = this.createPlayer(path, false)
    music.loop = true
    music.volume = MUSIC_VOLUME
    this.music = music
    this.resume()
  }

  private createPlayer(path: string, useWebAudioImplement: boolean) {
    const context = (Taro.createInnerAudioContext as any)({ useWebAudioImplement })
    context.src = path
    context.onError?.((error: unknown) => console.warn('快乐小鸟音频错误:', error))
    return context
  }
}
