import { describe, expect, it, vi } from 'vitest';
import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import {
  ABS_CORRECTED_REASON,
  applyAbsCorrection,
  checkAbsWithVision,
  confirmsNoDefinition,
  getAbsCheckConfig,
  parseAbsVerdict,
  saysNoDefinition,
  type AbsVerdict,
} from './bojiAbsCheck';

const CONFIG = { enabled: true, confirmModel: 'gpt-5.4-mini', timeoutMs: 1000, confirmTimeoutMs: 2000 };

function block(side: 'image_left' | 'image_right', index: number, enclosure: number) {
  return { side, index, enclosure, depth: 0.03, outline: [[0, 0], [1, 0], [1, 1], [0, 1]] };
}

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80, values: {}, reasons: [], geometry: {}, ...patch };
}

/** 引擎把一个平肚子数成 6 块、腹肌 97 分（复现用户反馈） */
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

const verdict = (rows: number, definition: AbsVerdict['definition'], confidence = 0.9, visible = true) =>
  JSON.stringify({ visible, rows, definition, confidence, note: 'x' });

describe('parseAbsVerdict', () => {
  it('reads JSON inside a markdown fence', () => {
    expect(parseAbsVerdict('```json\n' + verdict(2, 'visible', 0.8) + '\n```')).toEqual({
      visible: true, rows: 2, definition: 'visible', confidence: 0.8,
    });
  });

  it('rejects malformed or out-of-range answers', () => {
    expect(parseAbsVerdict('no json here')).toBeNull();
    expect(parseAbsVerdict('{"visible": true, "rows": 7, "definition": "clear", "confidence": 1}')).toBeNull();
    expect(parseAbsVerdict('{"visible": "yes", "rows": 1, "definition": "clear", "confidence": 1}')).toBeNull();
    expect(parseAbsVerdict('{"visible": true, "rows": 1, "definition": "great", "confidence": 1}')).toBeNull();
    expect(parseAbsVerdict('{"visible": true, "rows": 1.5, "definition": "faint", "confidence": 1}')).toBeNull();
  });
});

describe('saysNoDefinition', () => {
  it('accepts none, or faint with at most one row, when visible and confident', () => {
    expect(saysNoDefinition(parseAbsVerdict(verdict(0, 'none')))).toBe(true);
    expect(saysNoDefinition(parseAbsVerdict(verdict(1, 'faint')))).toBe(true);
    expect(saysNoDefinition(parseAbsVerdict(verdict(2, 'faint')))).toBe(false);
    expect(saysNoDefinition(parseAbsVerdict(verdict(0, 'visible')))).toBe(false);
    expect(saysNoDefinition(parseAbsVerdict(verdict(0, 'none', 0.5)))).toBe(false);
    expect(saysNoDefinition(parseAbsVerdict(verdict(0, 'none', 0.9, false)))).toBe(false);
    expect(saysNoDefinition(null)).toBe(false);
  });

  it('lets the confirming model agree with up to two faint rows', () => {
    expect(confirmsNoDefinition(parseAbsVerdict(verdict(2, 'faint')))).toBe(true);
    expect(confirmsNoDefinition(parseAbsVerdict(verdict(3, 'faint')))).toBe(false);
    expect(confirmsNoDefinition(parseAbsVerdict(verdict(2, 'visible')))).toBe(false);
    expect(confirmsNoDefinition(parseAbsVerdict(verdict(0, 'none', 0.6)))).toBe(false);
  });
});

describe('applyAbsCorrection', () => {
  it('drops the extra blocks, caps the abs score and recomputes the total', () => {
    const before = analysis();
    const after = applyAbsCorrection(before, [
      { visible: true, rows: 0, definition: 'none', confidence: 0.95 },
      { visible: true, rows: 0, definition: 'none', confidence: 0.9 },
    ]);
    const abs = after.report.metrics.abs;
    expect(abs.values).toMatchObject({ pack_count: 0, blocks_image_left: 0, blocks_image_right: 0, engine_pack_count: 6, ai_rows: 0, ai_definition: 'none' });
    expect(abs.score).toBe(20);
    expect((abs.geometry as { blocks: unknown[] }).blocks).toEqual([]);
    expect(abs.reasons).toEqual(['low_light', ABS_CORRECTED_REASON]);
    expect(after.messages[ABS_CORRECTED_REASON].zh).toContain('AI 复核');
    expect(after.report.total.score).toBeCloseTo(80.5 + 0.35 * (20 - 97), 6);
    // 不改原对象
    expect(before.report.metrics.abs.values.pack_count).toBe(6);
    expect(before.report.total.score).toBe(80.5);
  });

  it('keeps the clearest block per side for one faint row and uses the smaller row count', () => {
    const after = applyAbsCorrection(analysis(), [
      { visible: true, rows: 1, definition: 'faint', confidence: 0.95 },
      { visible: true, rows: 2, definition: 'faint', confidence: 0.85 },
    ]);
    const abs = after.report.metrics.abs;
    expect(abs.values).toMatchObject({ pack_count: 2, blocks_image_left: 1, blocks_image_right: 1, ai_definition: 'faint' });
    expect(abs.score).toBe(45);
    const kept = (abs.geometry as { blocks: Array<{ enclosure: number }> }).blocks.map((b) => b.enclosure);
    expect(kept).toEqual([0.84, 0.82]);
  });

  it('never raises a score that was already below the cap', () => {
    const low = analysis();
    const lowered = { ...low, report: { ...low.report, metrics: { ...low.report.metrics, abs: { ...low.report.metrics.abs, score: 10 } } } };
    const after = applyAbsCorrection(lowered, [{ visible: true, rows: 1, definition: 'faint', confidence: 0.9 }]);
    expect(after.report.metrics.abs.score).toBe(10);
    expect(after.report.total.score).toBe(80.5);
  });
});

describe('checkAbsWithVision', () => {
  const run = (answers: Array<string | null>, patch: Partial<Parameters<typeof checkAbsWithVision>[0]> = {}) => {
    const ask = vi.fn(async () => answers.shift() ?? null);
    const result = checkAbsWithVision({ analysis: analysis(), cropBase64: 'abc', sex: 'male', ask, config: CONFIG, log: () => {}, ...patch });
    return { ask, result };
  };

  it('corrects only when both models see no clear blocks', async () => {
    const { ask, result } = run([verdict(1, 'faint'), verdict(2, 'faint')]);
    const out = await result;
    expect(ask).toHaveBeenNthCalledWith(1, 'abc', null);
    expect(ask).toHaveBeenNthCalledWith(2, 'abc', 'gpt-5.4-mini');
    expect(out.report.metrics.abs.values.pack_count).toBe(2);
    expect(out.report.metrics.abs.score).toBe(45);
  });

  it('does not let the primary model correct on a faint two-row answer', async () => {
    const { ask, result } = run([verdict(2, 'faint')]);
    expect((await result).report.metrics.abs.values.pack_count).toBe(6);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('keeps the engine result when the confirming model sees abs', async () => {
    const { ask, result } = run([verdict(0, 'none'), verdict(3, 'visible')]);
    expect((await result).report.metrics.abs.values.pack_count).toBe(6);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('asks only once when the first model sees clear abs', async () => {
    const { ask, result } = run([verdict(3, 'clear')]);
    expect((await result).report.metrics.abs.values.pack_count).toBe(6);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('keeps the engine result when the model fails or answers nonsense', async () => {
    expect((await run([null]).result).report.metrics.abs.values.pack_count).toBe(6);
    expect((await run(['sorry, I cannot help']).result).report.metrics.abs.values.pack_count).toBe(6);
  });

  it('skips the check without a crop, for the female profile, when disabled or with few blocks', async () => {
    for (const patch of [
      { cropBase64: null },
      { sex: 'female' as const },
      { config: { ...CONFIG, enabled: false } },
    ]) {
      const { ask, result } = run([verdict(0, 'none'), verdict(0, 'none')], patch);
      expect((await result).report.metrics.abs.values.pack_count).toBe(6);
      expect(ask).not.toHaveBeenCalled();
    }
    const few = analysis();
    few.report.metrics.abs.values.pack_count = 2;
    const ask = vi.fn(async () => verdict(0, 'none'));
    await checkAbsWithVision({ analysis: few, cropBase64: 'abc', sex: 'male', ask, config: CONFIG, log: () => {} });
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('getAbsCheckConfig', () => {
  it('is on by default and can be switched off or tuned', () => {
    expect(getAbsCheckConfig({})).toEqual({ enabled: true, confirmModel: 'gpt-5.4-mini', timeoutMs: 15000, confirmTimeoutMs: 30000 });
    expect(getAbsCheckConfig({
      BOJI_AI_ABS_CHECK: 'OFF', BOJI_AI_ABS_CONFIRM_MODEL: 'm', BOJI_AI_ABS_TIMEOUT_MS: '9000', BOJI_AI_ABS_CONFIRM_TIMEOUT_MS: 'x',
    })).toEqual({ enabled: false, confirmModel: 'm', timeoutMs: 9000, confirmTimeoutMs: 30000 });
  });
});
