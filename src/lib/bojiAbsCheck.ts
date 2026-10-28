import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';

/**
 * 薄肌检测器：用视觉大模型复核腹肌块数，只纠正「数多了」。
 *
 * 引擎靠亮度找横沟，纹身、皮肤起伏和光影都可能被当成腹肌（2026-10-28 用户反馈
 * 「1 块识别成 8 块」，线上近一半检测判成 6 块以上）。这些假块的封闭度和深度与
 * 真腹肌几乎一样，调引擎门槛分不开，所以交给视觉模型看腹部裁图：
 * - 主模型（WANJIE_ARK_VISION_MODEL，关闭思考，约 5 秒）说「看不出分块」或「只有隐约一排」，
 * - 再请确认模型（默认 gpt-5.4-mini）独立看一次，它也认为不明显（最多隐约两排）才修正；
 *   确认模型同一张平肚子图会在 0 排和隐约 2 排之间摇摆，所以门槛比主模型宽；
 * - 模型说有明显腹肌时不动引擎结果（模型数排数本身不稳）。
 * 只发腹部裁图（检测服务裁好，不含脸），不保存。任何一步失败都保留引擎结果。
 */

export type AbsDefinition = 'none' | 'faint' | 'visible' | 'clear';

export interface AbsVerdict {
  visible: boolean;
  rows: number;
  definition: AbsDefinition;
  confidence: number;
}

export const ABS_CORRECTED_REASON = 'ai_abs_corrected';

const ABS_CORRECTED_MESSAGE = {
  zh: 'AI 复核：腹部看不出明显分块，已调低块数和腹肌分。光线太平或照片不清时也会这样，可换一张头顶光的照片再试。',
  en: 'AI review: no clear abdominal blocks, so the block count and abs score were lowered.',
};

/** 修正后腹肌分的上限 */
const SCORE_CAP: Record<'none' | 'faint', number> = { none: 20, faint: 45 };
/** 模型对「看不出分块」的把握低于这个值就不采纳 */
const MIN_CONFIDENCE = 0.7;
/** 引擎只数出这么多块时不用复核（多数的问题出在块数多的时候） */
const MIN_ENGINE_PACKS = 3;

export const ABS_CHECK_SYSTEM = '你是严谨的健身体态评估员，只根据照片里看得到的东西判断，不猜测、不恭维。只输出 JSON。';

export const ABS_CHECK_PROMPT = `这是一张男性腹部的裁剪照片（胸口到裤腰）。请判断腹直肌（腹肌）能清楚分出几排。

计数规则：
- 一排 = 左右并排的一对肌肉块，被上下两条横向的凹沟隔开，块本身明显鼓起。
- 只数真正能看出隆起轮廓的排。皮肤褶皱、坐姿或弯腰的肉褶、光影、纹身、体毛、肚脐、胸肌下沿、肋骨都不算。
- 肚子平滑、只有一条中线或完全看不出分块，就是 0 排。
- 按照片里实际看到的数，不要往多数也不要往少数；光线暗但轮廓能看出来的也算。

只输出一个 JSON：
{"visible": true 或 false（腹部是否清楚露出、没被衣服或手挡住、不糊）,
 "rows": 0 到 4 的整数,
 "definition": "none" | "faint" | "visible" | "clear"（none 看不出分块，faint 隐约，visible 明显，clear 非常清晰）,
 "confidence": 0 到 1,
 "note": "一句中文理由，20 字以内"}`;

const DEFINITIONS: AbsDefinition[] = ['none', 'faint', 'visible', 'clear'];

export function parseAbsVerdict(text: string): AbsVerdict | null {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const rows = Number(raw.rows);
  const confidence = Number(raw.confidence);
  const definition = String(raw.definition ?? '') as AbsDefinition;
  if (typeof raw.visible !== 'boolean' || !Number.isInteger(rows) || rows < 0 || rows > 4) return null;
  if (!DEFINITIONS.includes(definition) || !Number.isFinite(confidence)) return null;
  return { visible: raw.visible, rows, definition, confidence: Math.max(0, Math.min(1, confidence)) };
}

/** 主模型认为「没有明显分块」：看得清、有把握，而且看不出分块或只有隐约一排 */
export function saysNoDefinition(v: AbsVerdict | null): v is AbsVerdict {
  return !!v && v.visible && v.confidence >= MIN_CONFIDENCE
    && (v.definition === 'none' || (v.definition === 'faint' && v.rows <= 1));
}

/** 确认模型同意「不明显」：看不出分块，或最多隐约两排 */
export function confirmsNoDefinition(v: AbsVerdict | null): v is AbsVerdict {
  return !!v && v.visible && v.confidence >= MIN_CONFIDENCE
    && (v.definition === 'none' || (v.definition === 'faint' && v.rows <= 2));
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 两个模型都说没有明显分块时修正腹肌项并重算综合分（不改原对象）：
 * 块数取两者里较少的排数，分数上限按较宽的结论（有一个说隐约就按隐约）。
 */
export function applyAbsCorrection(analysis: BojiAnalysisDto, verdicts: AbsVerdict[]): BojiAnalysisDto {
  const abs = analysis.report.metrics.abs;
  if (!abs || abs.status === 'unavailable' || verdicts.length === 0) return analysis;
  const rows = Math.min(...verdicts.map((v) => v.rows));
  const level: 'none' | 'faint' = verdicts.some((v) => v.definition === 'faint') ? 'faint' : 'none';
  const enginePacks = finite(abs.values.pack_count) ?? 0;

  const geometry = abs.geometry as Record<string, unknown>;
  const blocks = Array.isArray(geometry.blocks) ? (geometry.blocks as Array<Record<string, any>>) : [];
  const kept = (['image_left', 'image_right'] as const).flatMap((side) =>
    blocks
      .filter((b) => b?.side === side)
      .sort((a, b) => (Number(b?.enclosure) || 0) - (Number(a?.enclosure) || 0))
      .slice(0, rows),
  );
  const count = (side: string) => kept.filter((b) => b.side === side).length;
  const packs = Math.min(enginePacks, kept.length);

  const oldScore = finite(abs.score);
  const score = oldScore === null ? null : Math.min(oldScore, SCORE_CAP[level]);
  const correctedAbs: BojiMetric = {
    ...abs,
    score,
    values: {
      ...abs.values,
      pack_count: packs,
      blocks_image_left: count('image_left'),
      blocks_image_right: count('image_right'),
      engine_pack_count: enginePacks,
      ai_rows: rows,
      ai_definition: level,
    },
    reasons: abs.reasons.includes(ABS_CORRECTED_REASON) ? abs.reasons : [...abs.reasons, ABS_CORRECTED_REASON],
    geometry: { ...geometry, blocks: kept },
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
      metrics: { ...analysis.report.metrics, abs: correctedAbs },
      total: { ...total, score: newTotal },
    },
    messages: { ...analysis.messages, [ABS_CORRECTED_REASON]: ABS_CORRECTED_MESSAGE },
  };
}

export interface AbsCheckConfig {
  enabled: boolean;
  confirmModel: string;
  /** 主模型超时（关闭思考，实测 3–11 秒） */
  timeoutMs: number;
  /** 确认模型超时：它开着思考，实测 5–21 秒；只有主模型说没有分块时才会调用 */
  confirmTimeoutMs: number;
}

function positiveMs(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAbsCheckConfig(env: Record<string, string | undefined> = process.env): AbsCheckConfig {
  return {
    enabled: String(env.BOJI_AI_ABS_CHECK ?? 'on').trim().toLowerCase() !== 'off',
    confirmModel: env.BOJI_AI_ABS_CONFIRM_MODEL?.trim() || 'gpt-5.4-mini',
    timeoutMs: positiveMs(env.BOJI_AI_ABS_TIMEOUT_MS, 15_000),
    confirmTimeoutMs: positiveMs(env.BOJI_AI_ABS_CONFIRM_TIMEOUT_MS, 30_000),
  };
}

/** 问一次视觉模型；model 为空用主模型。失败返回 null。 */
export type AskAbsModel = (cropBase64: string, model: string | null) => Promise<string | null>;

export async function checkAbsWithVision({
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
  const enginePacks = finite(abs?.values?.pack_count) ?? 0;
  // 女性档看马甲线、不数块；块数少时没有「数多了」的问题
  if (!config.enabled || !cropBase64 || sex !== 'male' || !abs || abs.status === 'unavailable' || enginePacks < MIN_ENGINE_PACKS) {
    return analysis;
  }
  const primary = parseAbsVerdict((await ask(cropBase64, null)) ?? '');
  if (!saysNoDefinition(primary)) {
    log(`[boji/ai-abs] engine ${enginePacks} kept (primary: ${primary ? `${primary.rows}/${primary.definition}` : 'no answer'})`);
    return analysis;
  }
  const confirm = parseAbsVerdict((await ask(cropBase64, config.confirmModel)) ?? '');
  if (!confirmsNoDefinition(confirm)) {
    log(`[boji/ai-abs] engine ${enginePacks} kept (confirm disagreed: ${confirm ? `${confirm.rows}/${confirm.definition}` : 'no answer'})`);
    return analysis;
  }
  log(`[boji/ai-abs] engine ${enginePacks} corrected to ${Math.min(primary.rows, confirm.rows)} rows (${primary.definition}/${confirm.definition})`);
  return applyAbsCorrection(analysis, [primary, confirm]);
}
