import { describe, expect, it } from 'vitest';
import { eyeLineFromFace, normalizeFacePoints } from '../apps/wechat/src/toolbox/games/faceAnchor';
import { createOneEuroFilter } from '../apps/wechat/src/toolbox/games/oneEuroFilter';

const FRAME = { frameHeight: 640, frameWidth: 480 };

/** 一张正对镜头的简化“脸”：眉眼一带、鼻子、嘴、下巴轮廓，坐标 0–1。 */
function facePoints(mouthOpen: number) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 20; i += 1) points.push({ x: 0.4 + i * 0.01, y: 0.30 + (i % 4) * 0.004 }); // 眉毛
  for (let i = 0; i < 24; i += 1) points.push({ x: 0.41 + i * 0.008, y: 0.33 + (i % 3) * 0.003 }); // 眼睛
  for (let i = 0; i < 16; i += 1) points.push({ x: 0.48 + (i % 4) * 0.01, y: 0.36 + i * 0.004 }); // 鼻子
  for (let i = 0; i < 20; i += 1) points.push({ x: 0.45 + i * 0.005, y: 0.45 + mouthOpen * (i % 2) }); // 嘴
  for (let i = 0; i < 26; i += 1) points.push({ x: 0.38 + i * 0.01, y: 0.32 + Math.sin((i / 25) * Math.PI) * (0.22 + mouthOpen) }); // 轮廓
  return points;
}

describe('face eye line', () => {
  const box = { ...FRAME, originY: 0.27, sizeWidth: 0.26 };

  it('sits at the brow and eye band, well above the box center', () => {
    const line = eyeLineFromFace({ ...box, points: facePoints(0) });
    expect(line.source).toBe('points');
    expect(line.eyeY).toBeGreaterThan(0.29);
    expect(line.eyeY).toBeLessThan(0.35);
  });

  it('does not move when the mouth opens and the chin drops', () => {
    const closed = eyeLineFromFace({ ...box, points: facePoints(0) }).eyeY;
    const open = eyeLineFromFace({ ...box, points: facePoints(0.06) }).eyeY;
    expect(Math.abs(open - closed)).toBeLessThan(0.004);
  });

  it('accepts landmarks in pixels as well as 0–1', () => {
    const pixels = facePoints(0).map((point) => ({ x: point.x * 480, y: point.y * 640 }));
    const fromPixels = eyeLineFromFace({ ...box, points: pixels }).eyeY;
    const fromUnits = eyeLineFromFace({ ...box, points: facePoints(0) }).eyeY;
    expect(fromPixels).toBeCloseTo(fromUnits, 5);
  });

  it('falls back to the top of the face box when there are no landmarks', () => {
    const line = eyeLineFromFace({ ...box, points: undefined });
    expect(line.source).toBe('box');
    expect(line.eyeY).toBeCloseTo(0.27 + 0.26 * 0.75 * 0.42, 5);
  });

  it('ignores junk points', () => {
    expect(normalizeFacePoints([{ x: 'a', y: 1 }, null, { x: 0.5, y: 0.5 }], 480, 640)).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(normalizeFacePoints('nope', 480, 640)).toEqual([]);
  });
});

describe('one euro filter', () => {
  const STEP_MS = 50;

  function run(values: number[]) {
    const filter = createOneEuroFilter();
    return values.map((value, index) => filter.filter(value, index * STEP_MS));
  }

  it('keeps jitter small while the head is still', () => {
    const noisy = Array.from({ length: 60 }, (_, i) => 0.5 + (i % 2 ? 0.005 : -0.005));
    const out = run(noisy).slice(20);
    const spread = Math.max(...out) - Math.min(...out);
    expect(spread).toBeLessThan(0.004);
  });

  it('follows a real movement quickly instead of lagging behind', () => {
    // 头 0.4 秒内从 0.4 移到 0.6（引体一次上拉的速度）。
    const path = Array.from({ length: 30 }, (_, i) => (i < 8 ? 0.4 + (0.2 * i) / 8 : 0.6));
    const out = run(path);
    expect(out[10]).toBeGreaterThan(0.57);
    expect(Math.abs(out[12] - 0.6)).toBeLessThan(0.02);
  });

  it('jumps straight to the new position after a long gap', () => {
    const filter = createOneEuroFilter();
    filter.filter(0.3, 0);
    expect(filter.filter(0.7, 2000)).toBe(0.7);
  });

  it('starts fresh after a reset', () => {
    const filter = createOneEuroFilter();
    filter.filter(0.3, 0);
    filter.reset();
    expect(filter.filter(0.8, 10)).toBe(0.8);
  });
});
