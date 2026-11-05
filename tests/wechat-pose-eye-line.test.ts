import { describe, expect, it } from 'vitest';
import { eyeYFromPose } from '../apps/wechat/src/toolbox/games/faceAnchor';

const MIN_SCORE = 0.3;

/** MoveNet 顺序：0 鼻子，1–2 眼睛，3–4 耳朵，其余身体点这里用不到。 */
function pose(parts: { nose?: number; eyes?: [number, number]; ears?: [number, number] }) {
  const hidden = { score: 0, x: 0.5, y: 0.5 };
  const seen = (y: number) => ({ score: 0.9, x: 0.5, y });
  return [
    parts.nose === undefined ? hidden : seen(parts.nose),
    parts.eyes ? seen(parts.eyes[0]) : hidden,
    parts.eyes ? seen(parts.eyes[1]) : hidden,
    parts.ears ? seen(parts.ears[0]) : hidden,
    parts.ears ? seen(parts.ears[1]) : hidden
  ];
}

describe('pose eye line', () => {
  it('uses the two eyes and ignores the nose below them', () => {
    expect(eyeYFromPose(pose({ eyes: [0.3, 0.32], ears: [0.33, 0.33], nose: 0.36 }), MIN_SCORE)).toBeCloseTo(0.31, 5);
  });

  it('falls back to the ears when the eyes are not visible', () => {
    expect(eyeYFromPose(pose({ ears: [0.31, 0.33], nose: 0.36 }), MIN_SCORE)).toBeCloseTo(0.32, 5);
  });

  it('gives no eye line from the nose alone', () => {
    expect(eyeYFromPose(pose({ nose: 0.36 }), MIN_SCORE)).toBeUndefined();
  });
});
