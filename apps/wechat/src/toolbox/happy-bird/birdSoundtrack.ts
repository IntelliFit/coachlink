import type { BirdEventType } from './birdTypes'
import {
  encodeWav,
  MUSIC_SAMPLE_RATE,
  renderMusicSamples,
  renderSfxSamples,
  SFX_SAMPLE_RATE,
  type SfxName
} from './birdSynth'

/**
 * 保存的视频没有声音：画布录制器只录画面。这里记下每个音效落在视频的第几帧，
 * 局后按同一套音效和音乐混成一条音轨，再由 birdVideoAudio 合进视频。
 * 纯逻辑，不依赖小程序 API。
 */

export type GameSound = { name: SfxName; volume: number }

export type SoundCue = GameSound & { at: number }

export type SoundtrackPlan = {
  cues: SoundCue[]
  durationSeconds: number
  musicFrom: number | null
  musicTo: number | null
}

export const MUSIC_VOLUME = 0.34
// 音轨不压缩直接写进视频，22.05kHz 每分钟约 2.6MB；音效本身就是这个采样率，音乐更低，不损失音质。
export const SOUNDTRACK_SAMPLE_RATE = 22050

const MAX_PEAK = 0.95

const EVENT_SOUNDS: Partial<Record<BirdEventType, GameSound>> = {
  bump: { name: 'hit', volume: 0.55 },
  coin: { name: 'coin', volume: 0.7 },
  countdownTick: { name: 'tick', volume: 1 },
  fever: { name: 'surge', volume: 1 },
  gameOver: { name: 'over', volume: 1 },
  go: { name: 'go', volume: 1 },
  hit: { name: 'hit', volume: 1 },
  level: { name: 'go', volume: 1 },
  pass: { name: 'pass', volume: 0.7 },
  perfect: { name: 'perfect', volume: 1 },
  shieldBreak: { name: 'hit', volume: 0.55 },
  shieldUp: { name: 'perfect', volume: 1 },
  smash: { name: 'hit', volume: 0.55 }
}

export function soundForEvent(type: BirdEventType): GameSound | null {
  return EVENT_SOUNDS[type] || null
}

/**
 * 视频时间以“已经画了多少帧”为准，不用真实时钟：手机忙不过来丢帧时，
 * 视频会比真实时间短，只有按帧算，音效才能和画面对上。
 */
export function createSoundTimeline(fps: number) {
  const cues: SoundCue[] = []
  let pending: GameSound[] = []
  let framesDrawn = 0
  let musicFrom: number | null = null
  let musicTo: number | null = null
  let musicStartPending = false
  let musicStopPending = false
  const videoTime = () => framesDrawn / fps

  const flush = () => {
    const at = videoTime()
    pending.forEach((sound) => cues.push({ ...sound, at }))
    pending = []
    if (musicStartPending && musicFrom === null) musicFrom = at
    if (musicStopPending && musicTo === null) musicTo = at
    musicStartPending = false
    musicStopPending = false
  }

  return {
    frameDrawn() {
      flush()
      framesDrawn += 1
    },
    noteMusicStart() {
      musicStartPending = true
    },
    noteMusicStop() {
      musicStopPending = true
    },
    noteSound(sound: GameSound) {
      pending.push(sound)
    },
    plan(): SoundtrackPlan {
      flush()
      const durationSeconds = videoTime()
      return {
        cues: [...cues],
        durationSeconds,
        musicFrom,
        musicTo: musicFrom === null ? null : musicTo ?? durationSeconds
      }
    }
  }
}

function addSamples(mix: Float32Array, source: Float32Array, sourceRate: number, atSeconds: number, gain: number, endSeconds = Infinity) {
  const ratio = sourceRate / SOUNDTRACK_SAMPLE_RATE
  const start = Math.round(atSeconds * SOUNDTRACK_SAMPLE_RATE)
  const end = Math.min(mix.length, endSeconds * SOUNDTRACK_SAMPLE_RATE)
  for (let target = start, position = 0; target < end; target += 1, position += ratio) {
    const index = Math.floor(position)
    if (index + 1 >= source.length) break
    const fraction = position - index
    mix[target] += (source[index] * (1 - fraction) + source[index + 1] * fraction) * gain
  }
}

function mixSoundtrack(plan: SoundtrackPlan): Float32Array | null {
  if (plan.durationSeconds <= 0 || (!plan.cues.length && plan.musicFrom === null)) return null
  const mix = new Float32Array(Math.ceil(plan.durationSeconds * SOUNDTRACK_SAMPLE_RATE))

  if (plan.musicFrom !== null) {
    const music = renderMusicSamples()
    const end = plan.musicTo ?? plan.durationSeconds
    const loopSeconds = music.length / MUSIC_SAMPLE_RATE
    for (let at = plan.musicFrom; at < end; at += loopSeconds) {
      addSamples(mix, music, MUSIC_SAMPLE_RATE, at, MUSIC_VOLUME, end)
    }
  }

  const rendered = new Map<SfxName, Float32Array>()
  plan.cues.forEach((cue) => {
    const samples = rendered.get(cue.name) || renderSfxSamples(cue.name)
    rendered.set(cue.name, samples)
    addSamples(mix, samples, SFX_SAMPLE_RATE, cue.at, cue.volume)
  })

  const peak = mix.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  const scale = peak > MAX_PEAK ? MAX_PEAK / peak : 1
  return scale === 1 ? mix : mix.map((value) => value * scale)
}

/** 混成 16 位 PCM，直接写进视频；一个声音都没有时返回 null，不必写。 */
export function renderSoundtrackPcm(plan: SoundtrackPlan): Int16Array | null {
  const mix = mixSoundtrack(plan)
  if (!mix) return null
  return Int16Array.from(mix, (value) => Math.round(Math.max(-1, Math.min(1, value)) * 32767))
}

/** 同一条音轨的 WAV 版，测试里拿来检查波形。 */
export function renderSoundtrack(plan: SoundtrackPlan): ArrayBuffer | null {
  const mix = mixSoundtrack(plan)
  return mix ? encodeWav(mix, SOUNDTRACK_SAMPLE_RATE) : null
}
