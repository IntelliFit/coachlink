import Taro from '@tarojs/taro'
import { realtimeLog } from '../games/realtimeLog'
import { renderSoundtrackPcm, SOUNDTRACK_SAMPLE_RATE, type SoundtrackPlan } from './birdSoundtrack'
import { listBoxes, planPcmAppend, type ReadAt } from './mp4PcmTrack'

declare const wx: any

const OUTPUT_DIR = 'game-replay-audio'
const LOG_TAG = 'game-replay-audio'

export type MergeStage = 'check' | 'merge' | 'soundtrack'

export type MergeOptions = {
  /** 写进实时日志的附加字段，比如页面里录制收尾花了多久。 */
  logFields?: Record<string, number | string>
  onStage?: (stage: MergeStage) => void
}

function fileSystem() {
  return Taro.getFileSystemManager() as any
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function openReader(path: string) {
  const fs = fileSystem()
  const fd = fs.openSync({ filePath: path, flag: 'r' })
  const readAt: ReadAt = (position, length) => {
    const arrayBuffer = new ArrayBuffer(length)
    fs.readSync({ arrayBuffer, fd, length, offset: 0, position })
    return new Uint8Array(arrayBuffer)
  }
  return { close: () => fs.closeSync({ fd }), readAt }
}

/** 每局只留一份输出，开新一局前清掉上一局没转存走的文件。 */
function prepareOutputPath() {
  const fs = fileSystem()
  const dir = `${wx.env.USER_DATA_PATH}/${OUTPUT_DIR}`
  try {
    fs.rmdirSync(dir, true)
  } catch {
    // 目录不存在
  }
  fs.mkdirSync(dir, true)
  return `${dir}/replay-${Date.now()}.mp4`
}

/** 读不懂视频结构时把顶层布局写进日志，下次就知道微信录出来的是什么格式。 */
function describeLayout(path: string) {
  try {
    const fs = fileSystem()
    const size = fs.statSync(path).size
    const reader = openReader(path)
    try {
      return listBoxes(reader.readAt, 0, size).map((box) => `${box.type}:${box.size}`).join(',').slice(0, 200)
    } finally {
      reader.close()
    }
  } catch (error: any) {
    return `unreadable: ${String(error?.message || error).slice(0, 80)}`
  }
}

/**
 * 不重新编码，直接把音轨写进视频：复制原文件，moov 原地改名，末尾追加音频和新 moov。
 * 画面数据不动，耗时只和文件复制有关，几秒内完成。
 */
function writeAudioTrack(videoPath: string, pcm: Int16Array) {
  const fs = fileSystem()
  const size = fs.statSync(videoPath).size
  const reader = openReader(videoPath)
  let plan
  try {
    plan = planPcmAppend(reader.readAt, size, pcm, SOUNDTRACK_SAMPLE_RATE)
  } finally {
    reader.close()
  }

  const output = prepareOutputPath()
  fs.copyFileSync(videoPath, output)
  const fd = fs.openSync({ filePath: output, flag: 'r+' })
  try {
    plan.patches.forEach((patch) => fs.writeSync({ data: toArrayBuffer(patch.bytes), fd, position: patch.position }))
  } finally {
    fs.closeSync({ fd })
  }
  plan.appendParts.forEach((part) => fs.appendFileSync(output, toArrayBuffer(part)))
  return output
}

/**
 * 把游戏音效和音乐写进录好的视频，返回带声音的文件路径。
 * 失败时抛错，调用方保留原来的无声视频，不能让用户一局白录。
 */
export async function addSoundtrackToVideo(videoPath: string, plan: SoundtrackPlan, options: MergeOptions = {}) {
  const timings: Record<string, number> = {}
  const startedAt = Date.now()
  const base = { ...options.logFields, videoSeconds: Math.round(plan.durationSeconds) }
  try {
    options.onStage?.('soundtrack')
    const pcm = renderSoundtrackPcm(plan)
    if (!pcm) return videoPath
    timings.soundtrackMs = Date.now() - startedAt

    options.onStage?.('merge')
    // 让按钮上的“合成声音”先显示出来，再做同步的文件读写。
    await new Promise((resolve) => setTimeout(resolve, 0))
    const mergeStartedAt = Date.now()
    const merged = writeAudioTrack(videoPath, pcm)
    timings.mergeMs = Date.now() - mergeStartedAt

    realtimeLog('info', LOG_TAG, { ...base, ...timings, method: 'pcm-append', totalMs: Date.now() - startedAt })
    return merged
  } catch (error: any) {
    realtimeLog('warn', LOG_TAG, {
      ...base,
      ...timings,
      error: String(error?.message || error),
      layout: describeLayout(videoPath),
      method: 'pcm-append',
      totalMs: Date.now() - startedAt
    })
    throw error
  }
}
