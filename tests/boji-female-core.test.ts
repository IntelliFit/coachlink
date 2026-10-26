import { describe, expect, it } from 'vitest';
import {
  bojiMetricCards,
  bojiMetricOrder,
  bojiMetricTitle,
  bojiOverlayShapes,
  bojiPhotoTips,
  bojiReportSex,
  isBojiSex,
  type BojiAnalysisDto,
  type BojiMetric,
  type BojiReport,
} from '../packages/core/src/bojiDetector';
import {
  bojiDuelMetricLabel,
  bojiPercentile,
  bojiScoreSnapshot,
  compareBojiScores,
  lookalikeForMeasures,
  lookalikeForSnapshot,
} from '../packages/core/src/bojiInsights';
import {
  BOJI_FEMALE_LOOKALIKE_REFERENCE,
  BOJI_FEMALE_LOOKALIKES,
  BOJI_LOOKALIKES,
  matchBojiFemaleLookalike,
} from '../packages/core/src/bojiLookalikes';

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80, values: {}, reasons: [], geometry: {}, ...patch };
}

function femaleReport(patch: Partial<BojiReport> = {}): BojiReport {
  return {
    version: '0.2.0',
    image_size: [800, 1000],
    deskew_deg: 0,
    quality: [],
    profile: 'female',
    metrics: {
      abs: metric('abs', { score: 72.04, values: { line_index: 0.0143, pack_count: 2 } }),
      v_taper: metric('v_taper', { status: 'unavailable', score: null }),
      arms: metric('arms', { score: 99, values: { upper_ratio: 0.5 } }),
      symmetry: metric('symmetry', { score: 61 }),
      waist_hip: metric('waist_hip', {
        score: 88.26,
        values: { ratio: 0.701 },
        geometry: { waist_line: [[300, 500], [500, 500]], hip_line: [[260, 700], [540, 700]] },
      }),
    },
    total: { score: 77.3, weights_used: {}, missing: ['v_taper'], calibration: 'uncalibrated-v0' },
    to_original: [[1, 0, 0], [0, 1, 0]],
    original_size: null,
    ...patch,
  };
}

const analysis = (report: BojiReport): BojiAnalysisDto => ({ report, messages: {} });

describe('female report display', () => {
  it('reads the profile, defaulting old reports to male', () => {
    expect(bojiReportSex(femaleReport())).toBe('female');
    expect(bojiReportSex({ profile: undefined })).toBe('male');
    expect(isBojiSex('female')).toBe(true);
    expect(isBojiSex('x')).toBe(false);
  });

  it('shows vest line, waist/hip, shoulder/waist and symmetry, without arms', () => {
    const cards = bojiMetricCards(analysis(femaleReport()));
    expect(cards.map((c) => c.key)).toEqual(['abs', 'waist_hip', 'v_taper', 'symmetry']);
    expect(cards[0]).toMatchObject({ title: '马甲线', score: 72, headline: '马甲线清晰度 1.4' });
    expect(cards[1]).toMatchObject({ title: '腰臀比', headline: '腰臀比 0.70', score: 88 });
    expect(cards[2]).toMatchObject({ title: '肩腰比', status: 'unavailable', headline: '这张照片测不了' });
    expect(bojiMetricOrder('male')).not.toContain('waist_hip');
    expect(bojiMetricTitle('abs', 'male').title).toBe('腹肌');
  });

  it('draws the hip line, and the waist from waist/hip when shoulders are not measured', () => {
    const kinds = bojiOverlayShapes(femaleReport()).map((s) => s.kind);
    expect(kinds).toContain('hip');
    expect(kinds).toContain('waist');
    expect(kinds).not.toContain('shoulder');
  });

  it('has its own photo tips', () => {
    expect(bojiPhotoTips('female')).not.toEqual(bojiPhotoTips('male'));
    expect(bojiPhotoTips('female').join('')).toContain('髋部');
  });
});

describe('female insights', () => {
  it('snapshots waist/hip and the vest-line index', () => {
    const snap = bojiScoreSnapshot(femaleReport());
    expect(snap.sex).toBe('female');
    expect(snap.scores.waist_hip).toBe(88.3);
    expect(snap.waistHipRatio).toBe(0.701);
    expect(snap.absLineIndex).toBe(0.0143);
    expect(bojiScoreSnapshot(femaleReport({ profile: 'male' })).scores.waist_hip).toBeUndefined();
  });

  it('matches against the female list only', () => {
    const match = lookalikeForSnapshot(bojiScoreSnapshot(femaleReport()));
    expect(BOJI_FEMALE_LOOKALIKES.map((l) => l.key)).toContain(match?.key);
    expect(match?.traits).toHaveLength(2);           // shoulders were not measurable
    expect(BOJI_LOOKALIKES.map((l) => l.key)).not.toContain('pamela_reif');
  });

  it('places measures at the reference median on the middle levels', () => {
    const ref = BOJI_FEMALE_LOOKALIKE_REFERENCE;
    const middle = matchBojiFemaleLookalike({
      absLineIndex: ref.absLineIndex.median,
      waistHipRatio: ref.waistHipRatio.median,
      shoulderWaistRatio: ref.shoulderWaistRatio.median,
    });
    expect(middle?.traits).toEqual(['马甲线隐约可见', '腰臀曲线中等', '肩腰比例中等']);
    // A smaller waist/hip ratio means a curvier figure.
    const curvy = matchBojiFemaleLookalike({ absLineIndex: ref.absLineIndex.median, waistHipRatio: 0.6, shoulderWaistRatio: 1.72 });
    expect(curvy?.traits?.[1]).toBe('腰臀曲线明显');
    expect(curvy?.groupLabel).toBe('曲线型');
    expect(lookalikeForMeasures('male', { absLineIndex: 0.03, waistHipRatio: 0.6 })).toBeNull();
  });

  it('gives every woman on the list a different combination of levels', () => {
    const points = BOJI_FEMALE_LOOKALIKES.map((l) => `${l.target.abs},${l.target.curve},${l.target.vTaper}`);
    expect(new Set(points).size).toBe(points.length);
    expect(new Set(BOJI_FEMALE_LOOKALIKES.map((l) => l.key)).size).toBe(BOJI_FEMALE_LOOKALIKES.length);
    for (const l of BOJI_FEMALE_LOOKALIKES) {
      for (const v of Object.values(l.target)) {
        expect(Math.abs(v)).toBeLessThanOrEqual(1.5);
        expect(Number.isInteger(v * 2)).toBe(true);
      }
    }
  });

  it('estimates the percentile from the female prior', () => {
    expect(bojiPercentile(68, null, undefined, 'female')).toEqual({ value: 50, basis: 'estimate', sampleUsers: 0 });
    expect(bojiPercentile(68, null)?.value).toBeLessThan(50);   // the male prior is centred higher
  });
});

describe('PK across profiles', () => {
  const scores = (abs: number | null, v: number | null, arms: number | null, sym: number | null, wh?: number | null) => ({
    abs,
    v_taper: v,
    arms,
    symmetry: sym,
    ...(wh === undefined ? {} : { waist_hip: wh }),
  });

  it('compares women on vest line, waist/hip, shoulders and symmetry, never arms', () => {
    const duel = compareBojiScores(
      { sex: 'female', total: 80, scores: scores(80, 70, 99, 60, 90) },
      { sex: 'female', total: 70, scores: scores(70, 75, 10, 60, 80) },
    );
    expect(duel.lines.map((l) => l.key)).toEqual(['abs', 'waist_hip', 'v_taper', 'symmetry']);
    expect(duel).toMatchObject({ wins: 2, losses: 1, ties: 1, overall: 'win' });
  });

  it('only counts shared metrics between a man and a woman', () => {
    const duel = compareBojiScores(
      { sex: 'male', total: 80, scores: scores(80, 70, 60, 60) },
      { sex: 'female', total: 70, scores: scores(70, 75, 99, 60, 80) },
    );
    expect(duel.lines.map((l) => [l.key, l.outcome])).toEqual([
      ['abs', 'win'],
      ['waist_hip', null],
      ['v_taper', 'lose'],
      ['arms', null],
      ['symmetry', 'tie'],
    ]);
  });

  it('labels metrics for the viewer', () => {
    expect(bojiDuelMetricLabel('abs', 'female')).toBe('马甲线');
    expect(bojiDuelMetricLabel('abs', 'male')).toBe('腹肌');
    expect(bojiDuelMetricLabel('waist_hip', 'male')).toBe('腰臀比');
  });
});
