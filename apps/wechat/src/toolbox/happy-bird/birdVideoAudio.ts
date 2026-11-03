import Taro from '@tarojs/taro'
import { mergeTimeoutMs, renderSoundtrack, type SoundtrackPlan } from './birdSoundtrack'

declare const wx: any

const SOUNDTRACK_FILE = 'happy-bird-soundtrack.wav'
const LOG_TAG = 'game-replay-audio'

type MediaTrack = { kind: string; volume?: number }

export type MergeStage = 'check' | 'merge' | 'soundtrack'

export type MergeOptions = {
  /** 写进实时日志的附加字段，比如页面里录制收尾花了多久。 */
  logFields?: Record<string, number | string>
  onStage?: (stage: MergeStage) => void
}

/** 真机上每一步花了多久写进小程序后台「实时日志」，慢或失败时能看到卡在哪。 */
function realtimeLog(level: 'info' | 'warn', payload: Record<string, unknown>) {
  try {
    const manager = typeof wx !== 'undefined' ? wx.getRealtimeLogManager?.() : null
    manager?.[level]?.(LOG_TAG, payload)
  } catch {
    // 日志只是排查用，写不进去不影响保存视频
  }
}

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

async function withTimeout<T>(work: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('合成声音超时')), timeoutMs)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
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

/**
 * 合成后只确认画面还在：有的手机读不出刚合成文件的音轨，以前为此把有声版扔掉、退回无声版。
 * 现在读不出音轨也保留合成版，最坏和无声版一样，不会更差；读不出画面才算失败。
 */
async function inspectMerged(path: string) {
  const container = createContainer()
  try {
    const tracks = await extractTracks(container, path)
    if (!tracks.some((track) => track.kind === 'video')) throw new Error('合成后的视频读不出画面')
    return tracks.some((track) => track.kind === 'audio')
  } finally {
    container.destroy?.()
  }
}

/**
 * 把游戏音效和音乐合进录好的视频，返回带声音的文件路径。
 * 失败时抛错，调用方保留原来的无声视频，不能让用户一局白录。
 */
export async function addSoundtrackToVideo(videoPath: string, plan: SoundtrackPlan, options: MergeOptions = {}) {
  const timings: Record<string, number> = {}
  const startedAt = Date.now()
  const base = { ...options.logFields, videoSeconds: Math.round(plan.durationSeconds) }
  const audioPath = `${wx.env.USER_DATA_PATH}/${SOUNDTRACK_FILE}`
  try {
    options.onStage?.('soundtrack')
    const wav = renderSoundtrack(plan)
    if (!wav) return videoPath
    await writeFile(audioPath, wav)
    timings.soundtrackMs = Date.now() - startedAt

    options.onStage?.('merge')
    const mergeStartedAt = Date.now()
    const merged = await withTimeout(mergeTracks(videoPath, audioPath), mergeTimeoutMs(plan.durationSeconds))
    timings.mergeMs = Date.now() - mergeStartedAt

    options.onStage?.('check')
    const checkStartedAt = Date.now()
    const audioFound = await withTimeout(inspectMerged(merged), mergeTimeoutMs(0))
    timings.checkMs = Date.now() - checkStartedAt

    realtimeLog('info', { ...base, ...timings, audioFound, totalMs: Date.now() - startedAt })
    return merged
  } catch (error: any) {
    realtimeLog('warn', { ...base, ...timings, error: String(error?.message || error), totalMs: Date.now() - startedAt })
    throw error
  } finally {
    Taro.getFileSystemManager().unlink({ filePath: audioPath, fail: () => undefined })
  }
}
