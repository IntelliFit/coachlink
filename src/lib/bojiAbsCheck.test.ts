import { describe, expect, it, vi } from 'vitest';
import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import {
  ABS_CORRECTED_REASON,
  applyAbsCount,
  checkAbsWithVision,
  getAbsCheckConfig,
  medianPacks,
  parseAbsCount,
} from './bojiAbsCheck';

const CONFIG = { enabled: true, timeoutMs: 1000, votes: 3 };

function block(side: 'image_left' | 'image_right', index: number, enclosure: number) {
  return { side, index, enclosure, depth: 0.03, outline: [[0, 0], [1, 0], [1, 1], [0, 1]] };
}

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80, values: {}, reasons: [], geometry: {}, ...patch };
}

/** 引擎数出 6 块、腹肌 97 分 */
function analysis(): BojiAnalysisDto {
  const blocks = [0.84, 0.77, 0.71].flatMap((e, i) => [block('image_left', i, e), block('image_right', i, e - 0.02)]);
  return {
    report: {
      version: '0.2.0',
      image_size: [800, 1000],
      deskew_deg: 0,
      quality: [],
      metrics: {
        abs: metric('abs', {
          score: 97,
          values: { pack_count: 6, blocks_image_left: 3, blocks_image_right: 3, definition_index: 0.73 },
          reasons: ['low_light'],
          geometry: { roi: [0, 0, 10, 10], blocks },
        }),
        v_taper: metric('v_taper', { score: 80 }),
        arms: metric('arms', { score: 70 }),
        symmetry: metric('symmetry', { score: 60 }),
      },
      total: { score: 80.5, weights_used: { abs: 0.35, v_taper: 0.3, arms: 0.2, symmetry: 0.15 }, missing: [], calibration: 'x' },
      to_original: [[1, 0, 0], [0, 1, 0]],
      original_size: null,
    },
    messages: { low_light: { zh: '光线暗', en: 'dark' } },
  };
}

const rows = (n: number) => JSON.stringify({ row1: n >= 1, row2: n >= 2, row3: n >= 3, row4: n >= 4 });

describe('parseAbsCount', () => {
  it('counts the rows answered true, inside a markdown fence too', () => {
    expect(parseAbsCount('```json\n' + rows(3) + '\n```')).toBe(6);
    expect(parseAbsCount(rows(0))).toBe(0);
    expect(parseAbsCount(rows(4))).toBe(8);
    expect(parseAbsCount('{"row1": false, "row2": true, "row3": false, "row4": true}')).toBe(4);
    expect(parseAbsCount('{"has_abs": false, "row1": false, "row2": false, "row3": false, "row4": false}')).toBe(0);
    expect(parseAbsCount('{"has_abs": true, "row1": true, "row2": true, "row3": true, "row4": false}')).toBe(6);
  });

  it('rejects incomplete or malformed answers', () => {
    expect(parseAbsCount('{"row1": true, "row2": true}')).toBeNull();
    expect(parseAbsCount('{"row1": "yes", "row2": true, "row3": true, "row4": true}')).toBeNull();
    expect(parseAbsCount('sorry')).toBeNull();
    expect(parseAbsCount('{broken')).toBeNull();
    expect(parseAbsCount(null)).toBeNull();
  });
});

describe('medianPacks', () => {
  it('takes the median of three and needs two valid votes', () => {
    expect(medianPacks([8, 6, 6])).toBe(6);
    expect(medianPacks([4, 8, 6])).toBe(6);
    expect(medianPacks([0, 0, 6])).toBe(0);
    expect(medianPacks([8, null, 6])).toBe(6);
    expect(medianPacks([8, null, null])).toBeNull();
    expect(medianPacks([])).toBeNull();
  });
});

describe('applyAbsCount', () => {
  it('zero blocks: drops the drawing, caps the score and recomputes the total', () => {
    const before = analysis();
    const after = applyAbsCount(before, 0);
    const abs = after.report.metrics.abs;
    expect(abs.values).toMatchObject({ pack_count: 0, blocks_image_left: 0, blocks_image_right: 0, engine_pack_count: 6 });
    expect(abs.score).toBe(20);
    expect((abs.geometry as { blocks: unknown[] }).blocks).toEqual([]);
    expect(abs.reasons).toEqual(['low_light', ABS_CORRECTED_REASON]);
    expect(after.messages[ABS_CORRECTED_REASON].zh).toContain('AI 复核');
    expect(after.report.total.score).toBeCloseTo(80.5 + 0.35 * (20 - 97), 6);
    // 不改原对象
    expect(before.report.metrics.abs.values.pack_count).toBe(6);
    expect(before.report.total.score).toBe(80.5);
  });

  it('two blocks: keeps the clearest block per side and caps at 45', () => {
    const abs = applyAbsCount(analysis(), 2).report.metrics.abs;
    expect(abs.score).toBe(45);
    const kept = (abs.geometry as { blocks: Array<{ enclosure: number }> }).blocks.map((b) => b.enclosure);
    expect(kept).toEqual([0.84, 0.82]);
  });

  it('four blocks: trims the drawing without touching the score or the reasons', () => {
    const after = applyAbsCount(analysis(), 4);
    const abs = after.report.metrics.abs;
    expect(abs.values).toMatchObject({ pack_count: 4, blocks_image_left: 2, blocks_image_right: 2 });
    expect((abs.geometry as { blocks: unknown[] }).blocks).toHaveLength(4);
    expect(abs.score).toBe(97);
    expect(abs.reasons).toEqual(['low_light']);
    expect(after.report.total.score).toBe(80.5);
  });

  it('more than the engine: only the number changes', () => {
    const abs = applyAbsCount(analysis(), 8).report.metrics.abs;
    expect(abs.values.pack_count).toBe(8);
    expect((abs.geometry as { blocks: unknown[] }).blocks).toHaveLength(6);
  });

  it('never raises a score already below the cap', () => {
    const low = analysis();
    low.report.metrics.abs.score = 10;
    const after = applyAbsCount(low, 2);
    expect(after.report.metrics.abs.score).toBe(10);
    expect(after.report.metrics.abs.reasons).toEqual(['low_light']);
    expect(after.report.total.score).toBe(80.5);
  });
});

describe('checkAbsWithVision', () => {
  const run = (answers: Array<string | null>, patch: Partial<Parameters<typeof checkAbsWithVision>[0]> = {}) => {
    const queue = [...answers];
    const ask = vi.fn(async () => queue.shift() ?? null);
    const result = checkAbsWithVision({ analysis: analysis(), cropBase64: 'abc', sex: 'male', ask, config: CONFIG, log: () => {}, ...patch });
    return { ask, result };
  };

  it('asks three times and uses the median', async () => {
    const { ask, result } = run([rows(2), rows(4), rows(2)]);
    expect((await result).report.metrics.abs.values.pack_count).toBe(4);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(ask).toHaveBeenCalledWith('abc');
  });

  it('accepts zero when most votes say zero', async () => {
    const out = await run([rows(0), rows(0), rows(3)]).result;
    expect(out.report.metrics.abs.values.pack_count).toBe(0);
    expect(out.report.metrics.abs.score).toBe(20);
  });

  it('leaves the result alone when the vote matches the engine', async () => {
    const out = await run([rows(3), rows(3), rows(3)]).result;
    expect(out.report.metrics.abs.values.engine_pack_count).toBeUndefined();
  });

  it('keeps the engine result when the model fails or answers nonsense', async () => {
    expect((await run([null, null, rows(1)]).result).report.metrics.abs.values.pack_count).toBe(6);
    expect((await run(['sorry', 'sorry', 'sorry']).result).report.metrics.abs.values.pack_count).toBe(6);
  });

  it('skips the check without a crop, for the female profile or when disabled', async () => {
    for (const patch of [{ cropBase64: null }, { sex: 'female' as const }, { config: { ...CONFIG, enabled: false } }]) {
      const { ask, result } = run([rows(0), rows(0), rows(0)], patch);
      expect((await result).report.metrics.abs.values.pack_count).toBe(6);
      expect(ask).not.toHaveBeenCalled();
    }
  });

  it('skips an unavailable abs metric', async () => {
    const un = analysis();
    un.report.metrics.abs.status = 'unavailable';
    const ask = vi.fn(async () => rows(0));
    await checkAbsWithVision({ analysis: un, cropBase64: 'abc', sex: 'male', ask, config: CONFIG, log: () => {} });
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('getAbsCheckConfig', () => {
  it('is on with three votes by default and can be tuned', () => {
    expect(getAbsCheckConfig({})).toEqual({ enabled: true, timeoutMs: 15000, votes: 3 });
    expect(getAbsCheckConfig({ BOJI_AI_ABS_CHECK: 'OFF', BOJI_AI_ABS_TIMEOUT_MS: '9000', BOJI_AI_ABS_VOTES: '5' }))
      .toEqual({ enabled: false, timeoutMs: 9000, votes: 5 });
  });
});
