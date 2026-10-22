import { describe, expect, it } from 'vitest';
import {
  bojiEnclosureColor,
  bojiMetricCards,
  bojiOverlayShapes,
  bojiQualityNotes,
  bojiTotalScore,
  mapPoint,
  type BojiAnalysisDto,
  type BojiMetric,
} from '../packages/core/src/bojiDetector';

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80.4, values: {}, reasons: [], geometry: {}, ...patch };
}

function analysis(): BojiAnalysisDto {
  return {
    report: {
      version: '0.1.0',
      image_size: [800, 1000],
      deskew_deg: 0,
      quality: ['hips_estimated'],
      metrics: {
        abs: metric('abs', {
          values: { pack_count: 6, blocks_image_left: 3, blocks_image_right: 3, definition_index: 0.912, mean_enclosure: 0.94 },
          geometry: {
            linea_alba: [[400, 300], [400, 600]],
            grooves: { image_left: [[[300, 350], [390, 352]]], image_right: [] },
            lateral_lines: { image_left: [[330, 300], [330, 600]] },
            blocks: [{ side: 'image_left', index: 0, outline: [[330, 300], [400, 300], [400, 350], [330, 350]], enclosure: 0.9 }],
          },
        }),
        v_taper: metric('v_taper', {
          values: { ratio: 1.724 },
          geometry: { shoulder_line: [[100, 200], [700, 200]], waist_line: [[250, 500], [550, 500]] },
        }),
        arms: metric('arms', { status: 'unavailable', score: null, reasons: ['arm_cut_off'] }),
        symmetry: metric('symmetry', {
          status: 'low_confidence',
          values: { silhouette_iou: 0.944, shoulder_tilt_deg: -2.86 },
          reasons: ['hips_estimated'],
        }),
      },
      total: { score: 77.6, weights_used: {}, missing: ['arms'], calibration: 'uncalibrated-v0' },
      to_original: [[2, 0, 10], [0, 2, 20]],
      original_size: [1610, 2020],
    },
    messages: {
      hips_estimated: { zh: '髋部不在画面内，躯干比例为估算', en: 'Hips not visible' },
      arm_cut_off: { zh: '手臂被画面边缘截断', en: 'An arm is cut off' },
    },
  };
}

describe('boji overlay shapes', () => {
  it('maps every point onto the uploaded photo', () => {
    expect(mapPoint([100, 200], [[2, 0, 10], [0, 2, 20]])).toEqual([210, 420]);
    const shapes = bojiOverlayShapes(analysis().report);
    const shoulder = shapes.find((s) => s.kind === 'shoulder');
    expect(shoulder?.points).toEqual([[210, 420], [1410, 420]]);
  });

  it('draws blocks first and skips unavailable metrics', () => {
    const shapes = bojiOverlayShapes(analysis().report);
    expect(shapes[0]).toMatchObject({ kind: 'block', closed: true, enclosure: 0.9 });
    expect(shapes.map((s) => s.kind)).toEqual(['block', 'groove', 'lateral', 'alba', 'shoulder', 'waist']);
    expect(shapes.some((s) => s.kind === 'arm')).toBe(false);
  });

  it('ignores malformed geometry instead of throwing', () => {
    const a = analysis();
    a.report.metrics.abs.geometry = { linea_alba: 'oops', blocks: [{ outline: [[1, 'x']] }], grooves: null };
    expect(() => bojiOverlayShapes(a.report)).not.toThrow();
    expect(bojiOverlayShapes(a.report).some((s) => s.kind === 'block')).toBe(false);
  });
});

describe('boji metric cards', () => {
  it('orders abs first and words each metric', () => {
    const cards = bojiMetricCards(analysis());
    expect(cards.map((c) => c.key)).toEqual(['abs', 'v_taper', 'arms', 'symmetry']);
    expect(cards[0]).toMatchObject({ score: 80, headline: '识别到 6 块' });
    expect(cards[0].details).toContain('照片左侧 3 块 · 右侧 3 块');
    expect(cards[1].headline).toBe('肩腰比 1.72');
    expect(cards[3]).toMatchObject({ status: 'low_confidence', headline: '轮廓重合 94%' });
    expect(cards[3].details).toEqual(['肩线倾斜 2.9°']);
  });

  it('shows unavailable metrics without a score and with readable reasons', () => {
    const arms = bojiMetricCards(analysis()).find((c) => c.key === 'arms');
    expect(arms).toMatchObject({ score: null, headline: '这张照片测不了', reasons: ['手臂被画面边缘截断'] });
  });

  it('falls back to the code for unknown reasons and rounds the total', () => {
    const a = analysis();
    a.report.quality = ['brand_new_code'];
    expect(bojiQualityNotes(a)).toEqual(['brand_new_code']);
    expect(bojiTotalScore(a)).toBe(78);
    a.report.total.score = null;
    expect(bojiTotalScore(a)).toBeNull();
  });

  it('colours enclosure from red to green', () => {
    expect(bojiEnclosureColor(0)).toBe('rgb(230, 90, 70)');
    expect(bojiEnclosureColor(1)).toBe('rgb(60, 200, 90)');
    expect(bojiEnclosureColor(5)).toBe(bojiEnclosureColor(1));
  });
});
