import { describe, expect, it, vi } from 'vitest';
import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import {
  applyVestVerdict,
  checkVestWithVision,
  NOT_VISIBLE_REASON,
  parseVestAnswer,
  VEST_LOWERED_REASON,
  vestVerdict,
} from './bojiVestCheck';

const CONFIG = { enabled: true, timeoutMs: 1000, votes: 3 };

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80, values: {}, reasons: [], geometry: {}, ...patch };
}

/** 引擎给马甲线 98 分（实测这个分数几乎不分有没有马甲线） */
function analysis(absScore: number | null = 98): BojiAnalysisDto {
  return {
    report: {
      version: '0.2.0',
      profile: 'female',
      image_size: [800, 1000],
      deskew_deg: 0,
      quality: [],
      metrics: {
        abs: metric('abs', { score: absScore, values: { line_index: 0.025 }, geometry: { roi: [0, 0, 10, 10] } }),
        waist_hip: metric('waist_hip', { score: 70, values: { ratio: 0.72 } }),
        v_taper: metric('v_taper', { score: 80 }),
        symmetry: metric('symmetry', { score: 60 }),
      },
      total: {
        score: 80,
        weights_used: { abs: 0.45, waist_hip: 0.25, v_taper: 0.15, symmetry: 0.15 },
        missing: [],
        calibration: 'x',
      },
      to_original: [[1, 0, 0], [0, 1, 0]],
      original_size: null,
    },
    messages: {},
  } as BojiAnalysisDto;
}

const answer = (view: string, midline = false, sides = false, blocks = false) =>
  JSON.stringify({ view, midline, sides, blocks });

describe('parseVestAnswer', () => {
  it('maps the yes/no answers to a level', () => {
    expect(parseVestAnswer(answer('front'))).toEqual({ view: 'front', level: 0 });
    expect(parseVestAnswer(answer('front', true))).toEqual({ view: 'front', level: 1 });
    expect(parseVestAnswer(answer('front', false, true))).toEqual({ view: 'front', level: 1 });
    expect(parseVestAnswer(answer('front', true, true))).toEqual({ view: 'front', level: 2 });
    expect(parseVestAnswer(answer('front', false, false, true))).toEqual({ view: 'front', level: 2 });
  });

  it('reads JSON wrapped in other text', () => {
    expect(parseVestAnswer(`结果：\n${answer('back')}`)).toEqual({ view: 'back', level: 0 });
  });

  it('returns null for anything else', () => {
    expect(parseVestAnswer(null)).toBeNull();
    expect(parseVestAnswer('不知道')).toBeNull();
    expect(parseVestAnswer('{broken')).toBeNull();
    expect(parseVestAnswer(JSON.stringify({ view: 'side', midline: true }))).toBeNull();
  });
});

describe('vestVerdict', () => {
  it('needs two valid answers', () => {
    expect(vestVerdict([{ view: 'front', level: 2 }, null, null])).toBeNull();
  });

  it('takes the majority view and the median level of the front answers', () => {
    expect(
      vestVerdict([{ view: 'front', level: 0 }, { view: 'front', level: 2 }, { view: 'front', level: 1 }]),
    ).toEqual({ view: 'front', level: 1 });
    expect(
      vestVerdict([{ view: 'back', level: 0 }, { view: 'back', level: 0 }, { view: 'front', level: 2 }]),
    ).toEqual({ view: 'back', level: 0 });
  });

  it('with two answers takes the lower level, and a split view counts as not visible', () => {
    expect(vestVerdict([{ view: 'front', level: 2 }, { view: 'front', level: 0 }, null])).toEqual({ view: 'front', level: 0 });
    expect(vestVerdict([{ view: 'front', level: 2 }, { view: 'back', level: 0 }, null])).toEqual({ view: 'other', level: 0 });
    expect(
      vestVerdict([{ view: 'front', level: 2 }, { view: 'back', level: 0 }, { view: 'other', level: 0 }]),
    ).toEqual({ view: 'other', level: 0 });
  });
});

describe('applyVestVerdict', () => {
  it('no vest line caps the score and lowers the total by its weight', () => {
    const before = analysis();
    const after = applyVestVerdict(before, { view: 'front', level: 0 });
    const abs = after.report.metrics.abs;
    expect(abs.score).toBe(40);
    expect(abs.values.vest_level).toBe(0);
    expect(abs.values.engine_line_index).toBe(0.025);
    expect(abs.values.line_index).toBeLessThan(0.014);
    expect(abs.reasons).toContain(VEST_LOWERED_REASON);
    expect(after.report.total.score).toBeCloseTo(80 + 0.45 * (40 - 98));
    expect(after.messages[VEST_LOWERED_REASON]?.zh).toContain('马甲线');
    expect(before.report.metrics.abs.score).toBe(98);
    expect(before.report.total.score).toBe(80);
  });

  it('a faint line stays between 50 and 70', () => {
    expect(applyVestVerdict(analysis(98), { view: 'front', level: 1 }).report.metrics.abs.score).toBe(70);
    expect(applyVestVerdict(analysis(30), { view: 'front', level: 1 }).report.metrics.abs.score).toBe(50);
    expect(applyVestVerdict(analysis(60), { view: 'front', level: 1 }).report.metrics.abs.score).toBe(60);
  });

  it('a clear line is at least 80, without a lowered note', () => {
    const raised = applyVestVerdict(analysis(52), { view: 'front', level: 2 });
    expect(raised.report.metrics.abs.score).toBe(80);
    expect(raised.report.metrics.abs.reasons).not.toContain(VEST_LOWERED_REASON);
    expect(raised.report.total.score).toBeCloseTo(80 + 0.45 * 28);
    expect(applyVestVerdict(analysis(98), { view: 'front', level: 2 }).report.metrics.abs.score).toBe(98);
  });

  it('a score below the cap is kept when there is no line', () => {
    const after = applyVestVerdict(analysis(30), { view: 'front', level: 0 });
    expect(after.report.metrics.abs.score).toBe(30);
    expect(after.report.metrics.abs.reasons).not.toContain(VEST_LOWERED_REASON);
    expect(after.report.total.score).toBe(80);
  });

  it('back views and hidden bellies get no vest score and no total', () => {
    for (const view of ['back', 'other'] as const) {
      const after = applyVestVerdict(analysis(), { view, level: 0 });
      expect(after.report.metrics.abs.status).toBe('unavailable');
      expect(after.report.metrics.abs.score).toBeNull();
      expect(after.report.metrics.abs.reasons).toContain(NOT_VISIBLE_REASON);
      expect(after.report.total.score).toBeNull();
      expect(after.report.total.missing).toContain('abs');
      expect(after.report.total.weights_used).toEqual({});
      expect(after.report.metrics.waist_hip.score).toBe(70);
      expect(after.messages[NOT_VISIBLE_REASON]?.zh).toContain('正面');
    }
  });
});

describe('checkVestWithVision', () => {
  it('asks three times and applies the verdict', async () => {
    const ask = vi.fn().mockResolvedValue(answer('front'));
    const log = vi.fn();
    const after = await checkVestWithVision({ analysis: analysis(), cropBase64: 'x', sex: 'female', ask, config: CONFIG, log });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(after.report.metrics.abs.score).toBe(40);
    expect(log.mock.calls[0][0]).toContain('[boji/ai-vest]');
  });

  it('keeps the engine result when the model gives no answer', async () => {
    const before = analysis();
    const after = await checkVestWithVision({
      analysis: before, cropBase64: 'x', sex: 'female', ask: async () => null, config: CONFIG, log: () => {},
    });
    expect(after).toBe(before);
  });

  it('does nothing for men, without a crop, when off, or when the abs were not measured', async () => {
    const ask = vi.fn();
    const before = analysis();
    const covered = analysis(null);
    covered.report.metrics.abs.status = 'unavailable';
    const runs = [
      { analysis: before, cropBase64: 'x', sex: 'male' as const, config: CONFIG },
      { analysis: before, cropBase64: null, sex: 'female' as const, config: CONFIG },
      { analysis: before, cropBase64: 'x', sex: 'female' as const, config: { ...CONFIG, enabled: false } },
      { analysis: covered, cropBase64: 'x', sex: 'female' as const, config: CONFIG },
    ];
    for (const run of runs) {
      expect(await checkVestWithVision({ ...run, ask, log: () => {} })).toBe(run.analysis);
    }
    expect(ask).not.toHaveBeenCalled();
  });
});
