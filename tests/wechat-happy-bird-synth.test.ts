import { describe, expect, it } from 'vitest';
import {
  encodeWav,
  musicNotes,
  renderMusic,
  renderNotes,
  renderSfx,
  SFX_NAMES,
  SFX_NOTES,
} from '../apps/wechat/src/toolbox/happy-bird/birdSynth';
import { replayHeightFor, BIRD_REPLAY_WIDTH } from '../apps/wechat/src/toolbox/happy-bird/birdRecorderSize';
import { isHappyBirdChunkModule } from '../apps/wechat/config/weappBojiChunk';

function readText(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');
}

function peakOf(wav: ArrayBuffer) {
  const samples = new Int16Array(wav.slice(44));
  return samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0) / 32767;
}

describe('happy bird synth', () => {
  it('writes a valid 16-bit mono WAV header', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 22050);
    const view = new DataView(wav);
    expect(readText(view, 0, 4)).toBe('RIFF');
    expect(readText(view, 8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44 + 2, true)).toBe(Math.round(0.5 * 32767));
  });

  it.each(SFX_NAMES)('renders %s audibly, without clipping and small enough to generate instantly', (name) => {
    const wav = renderSfx(name);
    const peak = peakOf(wav);
    expect(peak).toBeGreaterThan(0.15);
    expect(peak).toBeLessThanOrEqual(0.87);
    expect(wav.byteLength).toBeLessThan(50_000);
    expect(SFX_NOTES[name].notes.length).toBeGreaterThan(0);
  });

  it('renders the same audio every time', () => {
    expect(new Uint8Array(renderSfx('hit'))).toEqual(new Uint8Array(renderSfx('hit')));
  });

  it('renders an eight-bar music loop under 512 KB without clipping', () => {
    const { duration, notes } = musicNotes();
    expect(duration).toBeCloseTo(15, 0);
    notes.forEach((note) => {
      expect(Number.isFinite(note.frequency)).toBe(true);
      expect(note.at).toBeLessThan(duration);
    });
    const wav = renderMusic();
    expect(wav.byteLength).toBeLessThan(512 * 1024);
    expect(peakOf(wav)).toBeLessThanOrEqual(0.87);
    expect(peakOf(wav)).toBeGreaterThan(0.3);
  });

  it('normalizes loud mixes instead of clipping them', () => {
    const notes = Array.from({ length: 6 }, () => ({
      at: 0,
      duration: 0.1,
      frequency: 440,
      gain: 1,
      wave: 'sine' as const,
    }));
    const peak = renderNotes(notes, 0.1, 8000).reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(peak).toBeLessThanOrEqual(0.87);
  });
});

describe('happy bird chunking', () => {
  it('keeps game modules in the toolbox subpackage but leaves the page entry and styles to Taro', () => {
    const root = 'D:/repo/apps/wechat/src/toolbox/happy-bird';
    expect(isHappyBirdChunkModule(`${root}/birdModel.ts`)).toBe(true);
    expect(isHappyBirdChunkModule('D:\\repo\\apps\\wechat\\src\\toolbox\\happy-bird\\birdScene.ts')).toBe(true);
    expect(isHappyBirdChunkModule(`${root}/birdModel.ts?v=1`)).toBe(true);
    expect(isHappyBirdChunkModule(`${root}/index.tsx`)).toBe(false);
    expect(isHappyBirdChunkModule(`${root}/index.scss`)).toBe(false);
    expect(isHappyBirdChunkModule('D:/repo/apps/wechat/src/toolbox/dumbbell-bounce/bounceModel.ts')).toBe(false);
  });
});

describe('happy bird replay size', () => {
  it('matches the stage aspect and stays on a 16px grid', () => {
    const height = replayHeightFor(390, 753);
    expect(height % 16).toBe(0);
    expect(height / BIRD_REPLAY_WIDTH).toBeCloseTo(753 / 390, 1);
  });

  it('falls back to 9:16 before the stage is measured and clamps odd windows', () => {
    expect(replayHeightFor(0, 0)).toBe(800);
    expect(replayHeightFor(390, 3000) / BIRD_REPLAY_WIDTH).toBeLessThanOrEqual(2.25);
    expect(replayHeightFor(800, 600) / BIRD_REPLAY_WIDTH).toBeGreaterThanOrEqual(1.45);
  });
});
