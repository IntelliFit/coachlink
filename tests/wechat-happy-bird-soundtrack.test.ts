import { describe, expect, it } from 'vitest';
import {
  createSoundTimeline,
  mergeTimeoutMs,
  renderSoundtrack,
  soundForEvent,
  SOUNDTRACK_SAMPLE_RATE,
  type SoundtrackPlan
} from '../apps/wechat/src/toolbox/happy-bird/birdSoundtrack';

const FPS = 20;
const COIN = { name: 'coin', volume: 0.7 } as const;

function samplesOf(wav: ArrayBuffer | null) {
  expect(wav).not.toBeNull();
  return new Int16Array((wav as ArrayBuffer).slice(44));
}

function energy(samples: Int16Array, fromSeconds: number, toSeconds: number) {
  const from = Math.floor(fromSeconds * SOUNDTRACK_SAMPLE_RATE);
  const to = Math.min(samples.length, Math.floor(toSeconds * SOUNDTRACK_SAMPLE_RATE));
  let peak = 0;
  for (let index = from; index < to; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
  return peak / 32767;
}

const plan = (overrides: Partial<SoundtrackPlan> = {}): SoundtrackPlan => ({
  cues: [],
  durationSeconds: 4,
  musicFrom: null,
  musicTo: null,
  ...overrides
});

describe('happy bird sound timeline', () => {
  it('places a sound on the video frame it happened on, not on the wall clock', () => {
    const timeline = createSoundTimeline(FPS);
    for (let frame = 0; frame < 40; frame += 1) timeline.frameDrawn();
    timeline.noteSound(COIN);
    timeline.frameDrawn();
    expect(timeline.plan().cues).toEqual([{ ...COIN, at: 2 }]);
  });

  it('keeps sounds in sync when frames were dropped: fewer frames means an earlier video time', () => {
    const timeline = createSoundTimeline(FPS);
    // 真实过了 2 秒，但只画出 30 帧：视频时间是 1.5 秒。
    for (let frame = 0; frame < 30; frame += 1) timeline.frameDrawn();
    timeline.noteSound(COIN);
    expect(timeline.plan().cues[0].at).toBe(1.5);
    expect(timeline.plan().durationSeconds).toBe(1.5);
  });

  it('records when the music starts and stops', () => {
    const timeline = createSoundTimeline(FPS);
    for (let frame = 0; frame < 100; frame += 1) timeline.frameDrawn();
    timeline.noteMusicStart();
    for (let frame = 0; frame < 200; frame += 1) timeline.frameDrawn();
    timeline.noteMusicStop();
    for (let frame = 0; frame < 60; frame += 1) timeline.frameDrawn();
    const result = timeline.plan();
    expect(result.musicFrom).toBe(5);
    expect(result.musicTo).toBe(15);
    expect(result.durationSeconds).toBe(18);
  });

  it('runs the music to the end of the video when it was never stopped', () => {
    const timeline = createSoundTimeline(FPS);
    timeline.noteMusicStart();
    for (let frame = 0; frame < 40; frame += 1) timeline.frameDrawn();
    expect(timeline.plan().musicTo).toBe(2);
  });

  it('has no music range when the game never started', () => {
    const timeline = createSoundTimeline(FPS);
    timeline.frameDrawn();
    const result = timeline.plan();
    expect(result.musicFrom).toBeNull();
    expect(result.musicTo).toBeNull();
  });
});

describe('happy bird soundtrack', () => {
  it('uses the same sounds as the speaker for every audible event', () => {
    expect(soundForEvent('coin')).toEqual(COIN);
    expect(soundForEvent('hit')).toEqual({ name: 'hit', volume: 1 });
    expect(soundForEvent('rep')).toBeNull();
  });

  it('returns nothing when there is nothing to hear, so no merge is attempted', () => {
    expect(renderSoundtrack(plan())).toBeNull();
    expect(renderSoundtrack(plan({ durationSeconds: 0, cues: [{ ...COIN, at: 0 }] }))).toBeNull();
  });

  it('writes a 44.1kHz WAV exactly as long as the video', () => {
    const wav = renderSoundtrack(plan({ cues: [{ ...COIN, at: 1 }] })) as ArrayBuffer;
    const view = new DataView(wav);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(samplesOf(wav).length).toBe(4 * SOUNDTRACK_SAMPLE_RATE);
  });

  it('puts a cue where the timeline said and leaves silence elsewhere', () => {
    const samples = samplesOf(renderSoundtrack(plan({ cues: [{ ...COIN, at: 2 }] })));
    expect(energy(samples, 0, 1.99)).toBe(0);
    expect(energy(samples, 2, 2.2)).toBeGreaterThan(0.1);
    expect(energy(samples, 2.5, 4)).toBe(0);
  });

  it('plays music only between start and stop, looping past one pass', () => {
    const samples = samplesOf(renderSoundtrack(plan({ durationSeconds: 20, musicFrom: 2, musicTo: 18 })));
    expect(energy(samples, 0, 1.99)).toBe(0);
    expect(energy(samples, 3, 5)).toBeGreaterThan(0.05);
    expect(energy(samples, 17, 17.9)).toBeGreaterThan(0.05);
    expect(energy(samples, 18.01, 20)).toBe(0);
  });

  it('never clips when many sounds land together', () => {
    const cues = Array.from({ length: 30 }, () => ({ name: 'hit' as const, volume: 1, at: 1 }));
    const samples = samplesOf(renderSoundtrack(plan({ cues })));
    expect(energy(samples, 0, 4)).toBeLessThanOrEqual(0.951);
  });

  it('ignores a cue past the end of the video', () => {
    const samples = samplesOf(renderSoundtrack(plan({ durationSeconds: 1, cues: [{ ...COIN, at: 5 }] })));
    expect(samples.length).toBe(SOUNDTRACK_SAMPLE_RATE);
    expect(energy(samples, 0, 1)).toBe(0);
  });
});

describe('happy bird merge timeout', () => {
  it('never drops below a minute, so short rounds keep the old allowance', () => {
    expect(mergeTimeoutMs(0)).toBe(60000);
    expect(mergeTimeoutMs(5)).toBe(60000);
  });

  it('grows with the video, so a long round is not cut off at a fixed minute', () => {
    expect(mergeTimeoutMs(60)).toBe(135000);
    expect(mergeTimeoutMs(120)).toBeGreaterThan(mergeTimeoutMs(60));
  });

  it('is capped for the five-minute recording limit', () => {
    expect(mergeTimeoutMs(300)).toBe(8 * 60 * 1000);
    expect(mergeTimeoutMs(10_000)).toBe(8 * 60 * 1000);
  });
});
