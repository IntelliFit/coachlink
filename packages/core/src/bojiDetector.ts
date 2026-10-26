/**
 * 薄肌检测器（boji-detector）：网页和小程序共用的类型、标注图形和指标文案。
 * 结果字段与 Python 服务 `POST /v1/analyze` 一致，见
 * github.com/SmallHorseBrother/boji-detector。
 */

import type { BojiInsights } from './bojiInsights';

export type BojiMetricKey = 'v_taper' | 'symmetry' | 'arms' | 'abs' | 'waist_hip';
/** 打分档：女性看马甲线和腰臀比，手臂不计分（引擎 0.2 起） */
export type BojiSex = 'male' | 'female';
export type BojiMetricStatus = 'ok' | 'low_confidence' | 'unavailable';
export type BojiPoint = [number, number];
/** 2×3 仿射矩阵：分析图坐标 → 上传照片的坐标 */
export type BojiAffine = [[number, number, number], [number, number, number]];

export interface BojiMetric {
  key: BojiMetricKey;
  status: BojiMetricStatus;
  score: number | null;
  values: Record<string, number | string | boolean | null>;
  reasons: string[];
  geometry: Record<string, unknown>;
}

export interface BojiReport {
  version: string;
  image_size: [number, number];
  deskew_deg: number;
  quality: string[];
  /** 男性档没有 waist_hip */
  metrics: Partial<Record<BojiMetricKey, BojiMetric>>;
  total: { score: number | null; weights_used: Record<string, number>; missing: string[]; calibration: string };
  to_original: BojiAffine;
  original_size: [number, number] | null;
  /** 引擎 0.1 不返回，按男性档处理 */
  profile?: BojiSex;
}

export interface BojiAnalysisDto {
  report: BojiReport;
  /** 原因码 → 中英文说明 */
  messages: Record<string, { zh: string; en: string }>;
  /** 教链 API 附加：排名、最像谁、PK 结果（Python 服务不返回） */
  insights?: BojiInsights;
}

export const BOJI_METRIC_ORDER: BojiMetricKey[] = ['abs', 'v_taper', 'arms', 'symmetry'];
export const BOJI_FEMALE_METRIC_ORDER: BojiMetricKey[] = ['abs', 'waist_hip', 'v_taper', 'symmetry'];

export function isBojiSex(value: unknown): value is BojiSex {
  return value === 'male' || value === 'female';
}

export function bojiReportSex(report: Pick<BojiReport, 'profile'> | null | undefined): BojiSex {
  return report?.profile === 'female' ? 'female' : 'male';
}

export function bojiMetricOrder(sex: BojiSex): BojiMetricKey[] {
  return sex === 'female' ? BOJI_FEMALE_METRIC_ORDER : BOJI_METRIC_ORDER;
}
export const BOJI_UPLOAD_MAX_SIDE = 1600;

// ---------------------------------------------------------------------------
// 标注图形
// ---------------------------------------------------------------------------

export type BojiShapeKind = 'shoulder' | 'waist' | 'hip' | 'arm' | 'alba' | 'groove' | 'lateral' | 'block';

export interface BojiShape {
  kind: BojiShapeKind;
  points: BojiPoint[];
  closed: boolean;
  /** 只有腹肌块有：0–1，被沟围住的比例 */
  enclosure?: number;
}

function isPoint(value: unknown): value is BojiPoint {
  return Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

function pointList(value: unknown): BojiPoint[] {
  return Array.isArray(value) && value.every(isPoint) ? (value as BojiPoint[]) : [];
}

export function mapPoint([x, y]: BojiPoint, m: BojiAffine): BojiPoint {
  return [m[0][0] * x + m[0][1] * y + m[0][2], m[1][0] * x + m[1][1] * y + m[1][2]];
}

/** 把报告里的几何信息换算到上传照片的坐标，供 SVG / Canvas 绘制。 */
export function bojiOverlayShapes(report: BojiReport): BojiShape[] {
  const m = report.to_original;
  const shapes: BojiShape[] = [];
  const add = (kind: BojiShapeKind, raw: unknown, closed = false, enclosure?: number) => {
    const points = pointList(raw).map((p) => mapPoint(p, m));
    if (points.length >= 2) shapes.push({ kind, points, closed, ...(enclosure === undefined ? {} : { enclosure }) });
  };
  const abs = report.metrics.abs;
  if (abs && abs.status !== 'unavailable') {
    const g = abs.geometry as Record<string, any>;
    for (const block of Array.isArray(g.blocks) ? g.blocks : []) {
      add('block', block?.outline, true, typeof block?.enclosure === 'number' ? block.enclosure : 0);
    }
    for (const lines of Object.values((g.grooves ?? {}) as Record<string, unknown[]>)) {
      for (const line of Array.isArray(lines) ? lines : []) add('groove', line);
    }
    for (const line of Object.values((g.lateral_lines ?? {}) as Record<string, unknown>)) add('lateral', line);
    add('alba', g.linea_alba);
  }
  const arms = report.metrics.arms;
  if (arms && arms.status !== 'unavailable') {
    const lines = (arms.geometry as Record<string, unknown>).width_lines;
    for (const line of Array.isArray(lines) ? lines : []) add('arm', line);
  }
  const vTaper = report.metrics.v_taper;
  const vTaperShown = !!vTaper && vTaper.status !== 'unavailable';
  if (vTaper && vTaperShown) {
    add('shoulder', vTaper.geometry.shoulder_line);
    add('waist', vTaper.geometry.waist_line);
  }
  const waistHip = report.metrics.waist_hip;
  if (waistHip && waistHip.status !== 'unavailable') {
    if (!vTaperShown) add('waist', waistHip.geometry.waist_line);
    add('hip', waistHip.geometry.hip_line);
  }
  return shapes;
}

// ---------------------------------------------------------------------------
// 指标文案
// ---------------------------------------------------------------------------

export interface BojiMetricCard {
  key: BojiMetricKey;
  title: string;
  explain: string;
  status: BojiMetricStatus;
  score: number | null;
  headline: string;
  details: string[];
  reasons: string[];
}

const TITLES: Record<BojiMetricKey, { title: string; explain: string }> = {
  abs: { title: '腹肌', explain: '找出腹白线和每条横沟，逐块量它被沟围住了多少' },
  v_taper: { title: '倒三角', explain: '三角肌外缘宽 ÷ 最窄腰宽' },
  arms: { title: '手臂围度', explain: '上臂宽 ÷ 上臂长（肩到肘）' },
  symmetry: { title: '左右对称', explain: '轮廓左右镜像的重合度、肩线倾斜、左右上臂粗细比' },
  waist_hip: { title: '腰臀比', explain: '最窄腰宽 ÷ 最宽臀宽' },
};

const FEMALE_TITLES: Partial<Record<BojiMetricKey, { title: string; explain: string }>> = {
  abs: { title: '马甲线', explain: '看腹白线和腹部两侧竖线有多清楚，不数块' },
  v_taper: { title: '肩腰比', explain: '肩宽 ÷ 最窄腰宽' },
  waist_hip: { title: '腰臀比', explain: '最窄腰宽 ÷ 最宽臀宽，越小曲线越明显' },
};

export function bojiMetricTitle(key: BojiMetricKey, sex: BojiSex): { title: string; explain: string } {
  return (sex === 'female' ? FEMALE_TITLES[key] : undefined) ?? TITLES[key];
}

function num(values: Record<string, unknown>, key: string): number | null {
  const v = values[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function describeFemaleMetric(key: BojiMetricKey, values: Record<string, unknown>): { headline: string; details: string[] } | null {
  switch (key) {
    case 'abs': {
      const index = num(values, 'line_index');
      return {
        headline: index === null ? '—' : `马甲线清晰度 ${(index * 100).toFixed(1)}`,
        details: ['腹肌线条受光线影响大，前后对比请用同一地点和光线'],
      };
    }
    case 'v_taper': {
      const ratio = num(values, 'ratio');
      return { headline: ratio === null ? '—' : `肩腰比 ${ratio.toFixed(2)}`, details: ['健身女性多在 1.5–1.8'] };
    }
    case 'waist_hip': {
      const ratio = num(values, 'ratio');
      return { headline: ratio === null ? '—' : `腰臀比 ${ratio.toFixed(2)}`, details: ['正面轮廓宽度之比，女性常见 0.65–0.80'] };
    }
    default:
      return null;
  }
}

function describeMetric(key: BojiMetricKey, values: Record<string, unknown>, sex: BojiSex = 'male'): { headline: string; details: string[] } {
  const female = sex === 'female' ? describeFemaleMetric(key, values) : null;
  if (female) return female;
  switch (key) {
    case 'abs': {
      const packs = num(values, 'pack_count') ?? 0;
      const left = num(values, 'blocks_image_left');
      const right = num(values, 'blocks_image_right');
      return {
        headline: packs > 0 ? `识别到 ${packs} 块` : '没有识别到成块的腹肌',
        details: [
          `清晰度指数 ${(num(values, 'definition_index') ?? 0).toFixed(2)}`,
          `平均封闭度 ${pct(num(values, 'mean_enclosure'))}`,
          ...(left !== null && right !== null && packs > 0 ? [`照片左侧 ${left} 块 · 右侧 ${right} 块`] : []),
        ],
      };
    }
    case 'v_taper': {
      const ratio = num(values, 'ratio');
      return { headline: ratio === null ? '—' : `肩腰比 ${ratio.toFixed(2)}`, details: ['普通男性约 1.5，健身人群 1.7–1.9'] };
    }
    case 'arms': {
      const ratio = num(values, 'upper_ratio');
      const balance = num(values, 'balance');
      return {
        headline: ratio === null ? '—' : `上臂宽/长 ${ratio.toFixed(2)}`,
        details: balance === null ? [] : [`左右粗细比 ${balance.toFixed(2)}`],
      };
    }
    case 'waist_hip': {
      const ratio = num(values, 'ratio');
      return { headline: ratio === null ? '—' : `腰臀比 ${ratio.toFixed(2)}`, details: [] };
    }
    case 'symmetry': {
      const tilt = num(values, 'shoulder_tilt_deg');
      return {
        headline: `轮廓重合 ${pct(num(values, 'silhouette_iou'))}`,
        details: tilt === null ? [] : [`肩线倾斜 ${Math.abs(tilt).toFixed(1)}°`],
      };
    }
    default:
      return { headline: '—', details: [] };
  }
}

export function describeReason(code: string, messages: BojiAnalysisDto['messages']): string {
  return messages[code]?.zh ?? code;
}

export function bojiMetricCards(analysis: BojiAnalysisDto): BojiMetricCard[] {
  // 不用 flatMap：小程序的 TS lib 和部分旧基础库不支持。
  const cards: BojiMetricCard[] = [];
  const sex = bojiReportSex(analysis.report);
  for (const key of bojiMetricOrder(sex)) {
    const metric = analysis.report.metrics[key];
    if (!metric) continue;
    const text = metric.status === 'unavailable'
      ? { headline: '这张照片测不了', details: [] as string[] }
      : describeMetric(key, metric.values, sex);
    cards.push({
      key,
      ...bojiMetricTitle(key, sex),
      status: metric.status,
      score: metric.status === 'unavailable' || metric.score === null ? null : Math.round(metric.score),
      headline: text.headline,
      details: text.details,
      reasons: metric.reasons.map((code) => describeReason(code, analysis.messages)),
    });
  }
  return cards;
}

export function bojiTotalScore(analysis: BojiAnalysisDto): number | null {
  const score = analysis.report.total.score;
  return typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null;
}

/** 照片级别的提示（模糊、髋部不在画面内等） */
export function bojiQualityNotes(analysis: BojiAnalysisDto): string[] {
  return analysis.report.quality.map((code) => describeReason(code, analysis.messages));
}

/** 0–1 的封闭度 → 标注颜色：越绿越清晰 */
export function bojiEnclosureColor(enclosure: number): string {
  const v = Math.min(1, Math.max(0, enclosure));
  const r = Math.round(230 - 170 * v);
  const g = Math.round(90 + 110 * v);
  const b = Math.round(70 + 20 * v);
  return `rgb(${r}, ${g}, ${b})`;
}

export const BOJI_SHAPE_COLORS: Record<Exclude<BojiShapeKind, 'block'>, string> = {
  shoulder: '#FACC15',
  waist: '#EF4444',
  hip: '#D946EF',
  arm: '#22D3EE',
  alba: '#3B82F6',
  groove: '#F97316',
  lateral: '#7DD3FC',
};

export const BOJI_FEMALE_PHOTO_TIPS = [
  '正面站立，手臂自然下垂、离身体一拳，手不要放在髋部',
  '穿运动内衣和短裤或低腰裤，露出整个腹部，拍到大腿根',
  '相机与腰同高、正对身体，人占画面一半以上',
  '光源在头顶前上方；前后对比用同一地点、同一光线',
];

export function bojiPhotoTips(sex: BojiSex): string[] {
  return sex === 'female' ? BOJI_FEMALE_PHOTO_TIPS : BOJI_PHOTO_TIPS;
}

/** 女性结果页固定提示：不鼓励追求过低体脂 */
export const BOJI_FEMALE_HEALTH_NOTE = '线条好看不等于越瘦越好：女性体脂过低可能影响月经和骨骼健康，请在健康范围内练。';

export const BOJI_SEX_LABELS: Record<BojiSex, string> = { male: '男生', female: '女生' };

export const BOJI_PHOTO_TIPS = [
  '正面站立，手臂自然下垂、离身体约一拳',
  '上身裸露到裤腰，裤腰不要盖住肚脐以下',
  '相机与胸口同高、正对身体，人占画面一半以上',
  '光源在头顶前上方；前后对比用同一地点、同一光线',
];
