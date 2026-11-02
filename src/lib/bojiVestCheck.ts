import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import { getAbsCheckConfig, type AbsCheckConfig, type AskAbsModel } from '@/lib/bojiAbsCheck';

/**
 * 薄肌检测器女性档：用便宜的视觉模型复核马甲线（2026-11-01 用 142 张标注网图选定）。
 *
 * 引擎的 line_index 分不开有没有马甲线：平滑的肚子也常能拿 89–98 分，背面照也有分。
 * 验证集（只看没参与调提示词的照片）：没有马甲线 8/8 判对；背面 16/18 认出；
 * 挡住或没拍到肚子 10/12 认出；清晰的 5/8 判清晰、2/8 判隐约、1/8 判没有。
 * 已知代价：很浅的马甲线模型多半答「没有」，所以「没有」的上限给 40，不压到底。
 * 只发检测服务裁好的腹部（不含脸），不保存；答不出时保留引擎结果。
 */

export const VEST_LOWERED_REASON = 'ai_vest_lowered';
export const NOT_VISIBLE_REASON = 'ai_abdomen_not_visible';

const VEST_LOWERED_MESSAGE = {
  zh: 'AI 复核：肚子上看不出明显的马甲线，已调低这一项。光线太平或照片不清时也会这样，可换一张头顶光的照片再试。',
  en: 'AI review: no clear vest line on the abdomen, so this score was lowered.',
};

const NOT_VISIBLE_MESSAGE = {
  zh: 'AI 复核：这张照片看不到肚子正面（背面、侧身或被挡住），测不了马甲线，也不给综合分。请正面露出腹部再拍一张。',
  en: 'AI review: the front of the abdomen is not visible, so there is no vest line score or total. Use a front photo.',
};

export const VEST_CHECK_PROMPT = `这是一张女性腹部的裁剪照片。
第一步 view：这张裁剪照片拍到的是什么？
- front：肚子正面，能看到肚脐或腹部正中
- back：后背或腰背，能看到脊柱沟或背部
- other：侧身看不到腹部正中，或者被手臂、衣物挡住，或者看不清
第二步：只有 view 为 front 才逐项判断，其他情况都填 false。
- midline：肚脐上方有没有一条清楚的竖直中线（腹白线）。肚脐、肉褶、皮肤皱褶、衣服压痕、纹身、光影明暗都不算线条。
- sides：中线两侧有没有清楚的竖线或肌肉边缘（腹直肌外缘）
- blocks：肌肉有没有明显隆起、能看出分块
只输出 JSON：{"view": "front/back/other", "midline": true/false, "sides": true/false, "blocks": true/false}`;

const VIEWS = ['front', 'back', 'other'] as const;
export type VestView = (typeof VIEWS)[number];
/** 0 没有马甲线，1 隐约，2 清晰 */
export type VestLevel = 0 | 1 | 2;

export interface VestAnswer {
  view: VestView;
  level: VestLevel;
}

/** 档位 → 腹肌分范围。引擎分只在范围内起作用 */
const SCORE_RANGE: Record<VestLevel, [number, number]> = { 0: [0, 40], 1: [50, 70], 2: [80, 100] };
/** 档位 → line_index：匹配人物按它算档位，取参考中位数 ±1 个四分位距（见 BOJI_FEMALE_LOOKALIKE_REFERENCE） */
const LINE_INDEX: Record<VestLevel, number> = { 0: 0.006, 1: 0.014, 2: 0.022 };

/** 模型的回答 → 视角和档位；答不出返回 null */
export function parseVestAnswer(text: string | null): VestAnswer | null {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const answer = JSON.parse(match[0]) as Record<string, unknown>;
    const view = answer.view as VestView;
    if (!VIEWS.includes(view)) return null;
    const { midline, sides, blocks } = answer;
    if (![midline, sides, blocks].every((v) => typeof v === 'boolean')) return null;
    if (blocks || (midline && sides)) return { view, level: 2 };
    return { view, level: midline || sides ? 1 : 0 };
  } catch {
    return null;
  }
}

/** 至少两次有效回答才算数。视角要过半，否则按看不清；档位取正面回答的中位数，两次时取较低的 */
export function vestVerdict(answers: Array<VestAnswer | null>): VestAnswer | null {
  const valid = answers.filter((a): a is VestAnswer => a !== null);
  if (valid.length < 2) return null;
  const view = VIEWS.find((v) => valid.filter((a) => a.view === v).length * 2 > valid.length) ?? 'other';
  if (view !== 'front') return { view, level: 0 };
  const levels = valid.filter((a) => a.view === 'front').map((a) => a.level).sort((a, b) => a - b);
  return { view, level: levels[Math.floor((levels.length - 1) / 2)] };
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function withoutAbdomen(analysis: BojiAnalysisDto): BojiAnalysisDto {
  const abs = analysis.report.metrics.abs;
  const total = analysis.report.total;
  return {
    ...analysis,
    report: {
      ...analysis.report,
      metrics: {
        ...analysis.report.metrics,
        abs: { ...abs, status: 'unavailable', score: null, reasons: [...abs.reasons, NOT_VISIBLE_REASON] },
      },
      total: { ...total, score: null, weights_used: {}, missing: [...new Set([...total.missing, 'abs'])] },
    },
    messages: { ...analysis.messages, [NOT_VISIBLE_REASON]: NOT_VISIBLE_MESSAGE },
  };
}

/** 按模型结果改马甲线分（不改原对象），并按权重重算综合分 */
export function applyVestVerdict(analysis: BojiAnalysisDto, verdict: VestAnswer): BojiAnalysisDto {
  if (verdict.view !== 'front') return withoutAbdomen(analysis);
  const abs = analysis.report.metrics.abs;
  const [low, high] = SCORE_RANGE[verdict.level];
  const oldScore = finite(abs.score);
  const score = oldScore === null ? null : Math.max(low, Math.min(high, oldScore));
  const lowered = oldScore !== null && score !== null && score < oldScore && verdict.level === 0;
  const corrected: BojiMetric = {
    ...abs,
    score,
    values: {
      ...abs.values,
      line_index: LINE_INDEX[verdict.level],
      engine_line_index: abs.values.line_index ?? null,
      vest_level: verdict.level,
    },
    reasons: lowered ? [...abs.reasons, VEST_LOWERED_REASON] : abs.reasons,
  };
  const total = analysis.report.total;
  const weight = finite(total.weights_used?.abs);
  const oldTotal = finite(total.score);
  const newTotal = oldTotal !== null && weight !== null && oldScore !== null && score !== null
    ? oldTotal + weight * (score - oldScore)
    : oldTotal;
  return {
    ...analysis,
    report: {
      ...analysis.report,
      metrics: { ...analysis.report.metrics, abs: corrected },
      total: { ...total, score: newTotal },
    },
    messages: lowered ? { ...analysis.messages, [VEST_LOWERED_REASON]: VEST_LOWERED_MESSAGE } : analysis.messages,
  };
}

export async function checkVestWithVision({
  analysis,
  cropBase64,
  sex,
  ask,
  config = getAbsCheckConfig(),
  log = (message: string) => console.info(message),
}: {
  analysis: BojiAnalysisDto;
  cropBase64: string | null | undefined;
  sex: 'male' | 'female';
  ask: AskAbsModel;
  config?: AbsCheckConfig;
  log?: (message: string) => void;
}): Promise<BojiAnalysisDto> {
  const abs = analysis.report.metrics.abs;
  if (!config.enabled || !cropBase64 || sex !== 'female' || !abs || abs.status === 'unavailable') return analysis;
  const replies = await Promise.all(Array.from({ length: config.votes }, () => ask(cropBase64)));
  const answers = replies.map(parseVestAnswer);
  const verdict = vestVerdict(answers);
  log(`[boji/ai-vest] answers [${answers.map((a) => (a ? `${a.view}:${a.level}` : 'null')).join(',')}] -> ${verdict ? `${verdict.view}:${verdict.level}` : 'kept'}`);
  return verdict ? applyVestVerdict(analysis, verdict) : analysis;
}
