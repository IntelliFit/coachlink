import Taro from '@tarojs/taro'
import { renderSoundtrack, type SoundtrackPlan } from './birdSoundtrack'

declare const wx: any

const MERGE_TIMEOUT_MS = 60000
const SOUNDTRACK_FILE = 'happy-bird-soundtrack.wav'

type MediaTrack = { kind: string; volume?: number }

function extractTracks(container: any, source: string) {
  return new Promise<MediaTrack[]>((resolve, reject) => {
    container.extractDataSource({
      source,
      success: (result: any) => resolve(result?.tracks || []),
      fail: (error: any) => reject(new Error(error?.errMsg || '分离音视频轨道失败'))
    })
  })
}

function exportContainer(container: any) {
  return new Promise<string>((resolve, reject) => {
    container.export({
      success: (result: any) => {
        if (result?.tempFilePath) resolve(result.tempFilePath)
        else reject(new Error('合成后没有得到视频文件'))
      },
      fail: (error: any) => reject(new Error(error?.errMsg || '合成视频失败'))
    })
  })
}

function writeFile(path: string, data: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({
      data,
      filePath: path,
      success: () => resolve(),
      fail: (error: any) => reject(new Error(error?.errMsg || '写入音轨失败'))
    })
  })
}

function withTimeout<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('合成声音超时')), MERGE_TIMEOUT_MS)
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function createContainer() {
  const create = (Taro as any).createMediaContainer
  if (typeof create !== 'function') throw new Error('当前微信版本不支持音视频合成')
  return create.call(Taro)
}

async function mergeTracks(videoPath: string, audioPath: string) {
  const container = createContainer()
  try {
    const videoTrack = (await extractTracks(container, videoPath)).find((track) => track.kind === 'video')
    const audioTrack = (await extractTracks(container, audioPath)).find((track) => track.kind === 'audio')
    if (!videoTrack) throw new Error('录制的视频里没有画面轨道')
    if (!audioTrack) throw new Error('音轨文件读不出声音')
    container.addTrack(videoTrack)
    container.addTrack(audioTrack)
    audioTrack.volume = 1
    return await exportContainer(container)
  } finally {
    container.destroy?.()
  }
}

/** 部分手机合成“成功”但没声音，所以再读一遍结果，确认真的有音频轨道。 */
async function assertHasAudio(path: string) {
  const container = createContainer()
  try {
    const tracks = await extractTracks(container, path)
    if (!tracks.some((track) => track.kind === 'audio')) throw new Error('合成后的视频里没有声音')
  } finally {
    container.destroy?.()
  }
}

/**
 * 把游戏音效和音乐合进录好的视频，返回带声音的文件路径。
 * 失败时抛错，调用方保留原来的无声视频，不能让用户一局白录。
 */
export async function addSoundtrackToVideo(videoPath: string, plan: SoundtrackPlan) {
  const wav = renderSoundtrack(plan)
  if (!wav) return videoPath
  const audioPath = `${wx.env.USER_DATA_PATH}/${SOUNDTRACK_FILE}`
  await writeFile(audioPath, wav)
  try {
    const merged = await withTimeout(mergeTracks(videoPath, audioPath))
    await withTimeout(assertHasAudio(merged))
    return merged
  } finally {
    Taro.getFileSystemManager().unlink({ filePath: audioPath, fail: () => undefined })
  }
}
