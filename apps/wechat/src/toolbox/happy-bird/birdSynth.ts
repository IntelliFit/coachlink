/**
 * 快乐小鸟的音效和背景音乐全部用代码合成成 WAV：不占小程序包体积、没有版权问题，
 * 首次进页面时写进用户目录，之后直接复用。这里是纯函数，不依赖小程序 API。
 */

export type SynthWave = 'noise' | 'sine' | 'square' | 'triangle'

export type SynthNote = {
  at: number
  duration: number
  frequency: number
  gain: number
  slideTo?: number
  wave: SynthWave
}

export type SfxName = 'coin' | 'go' | 'hit' | 'over' | 'pass' | 'perfect' | 'surge' | 'tick'

export const SFX_NAMES: SfxName[] = ['coin', 'go', 'hit', 'over', 'pass', 'perfect', 'surge', 'tick']

export const SFX_SAMPLE_RATE = 22050
export const MUSIC_SAMPLE_RATE = 16000
const PEAK = 0.86
const ATTACK_SECONDS = 0.004
const TEMPO = 128
const NOTE_FREQUENCIES: Record<string, number> = {
  A2: 110, A3: 220, A4: 440, A5: 880,
  B2: 123.47, B3: 246.94, B4: 493.88, B5: 987.77,
  C3: 130.81, C4: 261.63, C5: 523.25, C6: 1046.5, C7: 2093,
  D3: 146.83, D4: 293.66, D5: 587.33, D6: 1174.66,
  E3: 164.81, E4: 329.63, E5: 659.25, E6: 1318.51,
  F2: 87.31, F3: 174.61, F4: 349.23, F5: 698.46,
  G2: 98, G3: 196, G4: 392, G5: 783.99, G6: 1567.98
}

function oscillator(wave: SynthWave, phase: number, noise: () => number) {
  if (wave === 'noise') return noise()
  if (wave === 'sine') return Math.sin(phase)
  if (wave === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase))
  // 只取前三个奇次谐波的方波，音色像老游戏机但不刺耳。
  return (Math.sin(phase) + Math.sin(phase * 3) / 3 + Math.sin(phase * 5) / 5) * 0.8
}

function createNoise(seed: number) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 2147483648 - 1
  }
}

function addNote(buffer: Float32Array, note: SynthNote, sampleRate: number, noise: () => number) {
  const start = Math.floor(note.at * sampleRate)
  const length = Math.floor(note.duration * sampleRate)
  const end = Math.min(buffer.length, start + length)
  let phase = 0
  for (let index = start; index < end; index += 1) {
    const t = (index - start) / sampleRate
    const progress = (index - start) / length
    const frequency = note.slideTo === undefined
      ? note.frequency
      : note.frequency * Math.pow(note.slideTo / note.frequency, progress)
    phase += (2 * Math.PI * frequency) / sampleRate
    const attack = Math.min(1, t / ATTACK_SECONDS)
    const decay = Math.pow(1 - progress, 1.6)
    buffer[index] += oscillator(note.wave, phase, noise) * note.gain * attack * decay
  }
}

export function renderNotes(notes: SynthNote[], durationSeconds: number, sampleRate: number) {
  const buffer = new Float32Array(Math.ceil(durationSeconds * sampleRate))
  const noise = createNoise(0x2f6e2b1)
  notes.forEach((note) => addNote(buffer, note, sampleRate, noise))
  const peak = buffer.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  if (peak <= PEAK || peak === 0) return buffer
  return buffer.map((value) => (value / peak) * PEAK)
}

export function encodeWav(samples: Float32Array, sampleRate: number) {
  const dataSize = samples.length * 2
  const bytes = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bytes)
  const writeText = (offset: number, text: string) => {
    text.split('').forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, dataSize, true)
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(44 + index * 2, Math.round(clamped * 32767), true)
  })
  return bytes
}

function arpeggio(names: string[], step: number, duration: number, wave: SynthWave, gain: number): SynthNote[] {
  return names.map((name, index) => ({
    at: index * step,
    duration,
    frequency: NOTE_FREQUENCIES[name],
    gain,
    wave
  }))
}

export const SFX_NOTES: Record<SfxName, { duration: number; notes: SynthNote[] }> = {
  coin: {
    duration: 0.22,
    notes: [
      { at: 0, duration: 0.07, frequency: NOTE_FREQUENCIES.E5, gain: 0.5, wave: 'sine' },
      { at: 0.055, duration: 0.16, frequency: NOTE_FREQUENCIES.C6, gain: 0.6, wave: 'sine' }
    ]
  },
  go: {
    duration: 0.5,
    notes: arpeggio(['C5', 'E5', 'G5', 'C6'], 0.07, 0.28, 'square', 0.4)
  },
  hit: {
    duration: 0.42,
    notes: [
      { at: 0, duration: 0.4, frequency: 170, gain: 0.95, slideTo: 42, wave: 'sine' },
      { at: 0, duration: 0.16, frequency: 1, gain: 0.5, wave: 'noise' },
      { at: 0.02, duration: 0.12, frequency: 1300, gain: 0.14, slideTo: 700, wave: 'square' }
    ]
  },
  over: {
    duration: 0.95,
    notes: arpeggio(['G4', 'E4', 'C4', 'G3'], 0.17, 0.42, 'square', 0.42)
  },
  pass: {
    duration: 0.12,
    notes: [{ at: 0, duration: 0.11, frequency: 480, gain: 0.6, slideTo: 860, wave: 'triangle' }]
  },
  perfect: {
    duration: 0.42,
    notes: arpeggio(['E5', 'G5', 'C6', 'E6', 'G6'], 0.05, 0.2, 'triangle', 0.52)
  },
  surge: {
    duration: 0.95,
    notes: [
      ...arpeggio(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6'], 0.075, 0.26, 'square', 0.32),
      { at: 0, duration: 0.9, frequency: 1, gain: 0.14, wave: 'noise' }
    ]
  },
  tick: {
    duration: 0.13,
    notes: [{ at: 0, duration: 0.12, frequency: 880, gain: 0.55, wave: 'square' }]
  }
}

export function renderSfxSamples(name: SfxName) {
  const { duration, notes } = SFX_NOTES[name]
  return renderNotes(notes, duration, SFX_SAMPLE_RATE)
}

export function renderSfx(name: SfxName) {
  return encodeWav(renderSfxSamples(name), SFX_SAMPLE_RATE)
}

type MusicBar = { arp: string[]; bass: string; melody: (string | null)[] }

// 8 小节循环：大调明快的自编旋律，每拍半音符一格；null 表示留空。
const MUSIC_BARS: MusicBar[] = [
  { arp: ['C4', 'E4', 'G4', 'E4'], bass: 'C3', melody: ['G5', null, 'E5', 'G5', 'A5', 'G5', 'E5', null] },
  { arp: ['B3', 'D4', 'G4', 'D4'], bass: 'G2', melody: ['D5', null, 'G5', 'D5', 'E5', 'D5', 'B4', null] },
  { arp: ['C4', 'E4', 'A4', 'E4'], bass: 'A2', melody: ['C5', null, 'E5', 'A5', 'G5', 'E5', 'C5', null] },
  { arp: ['C4', 'F4', 'A4', 'F4'], bass: 'F2', melody: ['A4', 'C5', 'F5', 'A5', 'G5', 'F5', 'E5', null] },
  { arp: ['C4', 'E4', 'G4', 'E4'], bass: 'C3', melody: ['G5', null, 'E5', 'G5', 'C6', 'G5', 'E5', null] },
  { arp: ['B3', 'D4', 'G4', 'D4'], bass: 'G2', melody: ['D5', null, 'G5', 'B5', 'A5', 'G5', 'D5', null] },
  { arp: ['C4', 'F4', 'A4', 'F4'], bass: 'F2', melody: ['A5', null, 'F5', 'A5', 'C6', 'A5', 'F5', null] },
  { arp: ['B3', 'D4', 'G4', 'D4'], bass: 'G2', melody: ['G5', 'A5', 'B5', 'D6', null, 'D6', 'B5', 'G5'] }
]

export function musicNotes() {
  const beat = 60 / TEMPO
  const eighth = beat / 2
  const bar = beat * 4
  const notes: SynthNote[] = []
  MUSIC_BARS.forEach((item, barIndex) => {
    const barStart = barIndex * bar
    const bassFrequency = NOTE_FREQUENCIES[item.bass]
    ;[0, 1.5, 2, 3].forEach((offset) => {
      notes.push({ at: barStart + offset * beat, duration: beat * 0.8, frequency: bassFrequency, gain: 0.5, wave: 'triangle' })
    })
    ;[0, 1, 2, 3].forEach((offset) => {
      notes.push({ at: barStart + offset * beat, duration: 0.12, frequency: 120, gain: 0.55, slideTo: 45, wave: 'sine' })
      notes.push({ at: barStart + (offset + 0.5) * beat, duration: 0.05, frequency: 1, gain: 0.06, wave: 'noise' })
    })
    ;[1, 3].forEach((offset) => {
      notes.push({ at: barStart + offset * beat, duration: 0.11, frequency: 1, gain: 0.16, wave: 'noise' })
    })
    for (let index = 0; index < 8; index += 1) {
      const name = item.arp[index % item.arp.length]
      notes.push({ at: barStart + index * eighth, duration: eighth * 0.9, frequency: NOTE_FREQUENCIES[name], gain: 0.09, wave: 'square' })
    }
    item.melody.forEach((name, index) => {
      if (!name) return
      notes.push({ at: barStart + index * eighth, duration: eighth * 1.5, frequency: NOTE_FREQUENCIES[name], gain: 0.22, wave: 'triangle' })
    })
  })
  return { duration: MUSIC_BARS.length * bar, notes }
}

export function renderMusicSamples() {
  const { duration, notes } = musicNotes()
  return renderNotes(notes, duration, MUSIC_SAMPLE_RATE)
}

export function renderMusic() {
  return encodeWav(renderMusicSamples(), MUSIC_SAMPLE_RATE)
}
