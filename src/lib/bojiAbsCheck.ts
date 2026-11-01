import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';

/**
 * 薄肌检测器：用便宜的视觉大模型数腹肌块数（2026-11-01 用人工标注照片选定）。
 *
 * 引擎靠亮度找横沟，纹身、皮肤起伏和光影都可能被当成腹肌，块数也常差一两块；
 * 这些假块的封闭度和深度与真腹肌几乎一样，调引擎门槛分不开。
 * 模型的问法很关键：直接问几排几乎都答 8；提示「大多数人 6 块」就都答 6；
 * 逐排问是非题才能分开 0、4、6、8。单次仍有波动，所以同时问 3 次取中位数。
 * 只发检测服务裁好的腹部（不含脸），不保存；答不出时保留引擎结果。
 */

export const ABS_CORRECTED_REASON = 'ai_abs_corrected';

const ABS_CORRECTED_MESSAGE = {
  zh: 'AI 复核：腹部看不出明显分块，已调低块数和腹肌分。光线太平或照片不清时也会这样，可换一张头顶光的照片再试。',
  en: 'AI review: no clear abdominal blocks, so the block count and abs score were lowered.',
};

/** 腹直肌每侧最多 4 行 */
const MAX_ROWS = 4;
/** 模型只看到这么多块时，引擎的高分不可信：块数 → 腹肌分上限 */
const SCORE_CAP: Record<number, number> = { 0: 20, 2: 45 };

export const ABS_CHECK_SYSTEM = '你是严谨的健身体态评估员，只根据照片里看得到的东西判断，不猜测、不恭维。只输出 JSON。';

export const ABS_COUNT_PROMPT = `这是一张男性腹部的裁剪照片。请数腹直肌能看出隆起轮廓的排数（一排 = 左右一对肌肉块）。
皮肤褶皱、光影、纹身、画上去的线条、体毛、肚脐、胸肌下沿、肋骨都不算。肚子平滑就是 0 排。

从上往下逐排判断。只有肌肉块明显隆起、上下边界都看得到才算 true；隐约、平滑或看不清都算 false。
- row1：紧贴胸肌下方的第一排
- row2：第二排
- row3：第三排（通常在肚脐上方）
- row4：肚脐附近或下方的第四排

只输出 JSON：{"row1": true/false, "row2": true/false, "row3": true/false, "row4": true/false}`;

/** 逐排的回答 → 块数（每排两块）；答不出返回 null */
export function parseAbsCount(text: string | null): number | null {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const answer = JSON.parse(match[0]) as Record<string, unknown>;
    const rows = Array.from({ length: MAX_ROWS }, (_, i) => answer[`row${i + 1}`]);
    return rows.every((r) => typeof r === 'boolean') ? rows.filter(Boolean).length * 2 : null;
  } catch {
    return null;
  }
}

/** 至少两次有效回答才算数；两次时取较小的，三次取中位数 */
export function medianPacks(votes: Array<number | null>): number | null {
  const valid = votes.filter((v): v is number => v !== null).sort((a, b) => a - b);
  return valid.length >= 2 ? valid[Math.floor((valid.length - 1) / 2)] : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function keepBestBlocks(blocks: Array<Record<string, any>>, perSide: number): Array<Record<string, any>> {
  return (['image_left', 'image_right'] as const).flatMap((side) =>
    blocks
      .filter((b) => b?.side === side)
      .sort((a, b) => (Number(b?.enclosure) || 0) - (Number(a?.enclosure) || 0))
      .slice(0, perSide),
  );
}

/**
 * 按模型结果改块数（不改原对象）：少于引擎时去掉多画的块，多于引擎时只改数字（画不出新的块）。
 * 模型只看到 0 或 2 块时给腹肌分封顶，并按权重重算综合分。
 */
export function applyAbsCount(analysis: BojiAnalysisDto, packs: number): BojiAnalysisDto {
  const abs = analysis.report.metrics.abs;
  const enginePacks = finite(abs.values.pack_count) ?? 0;
  const geometry = abs.geometry as Record<string, unknown>;
  const blocks = Array.isArray(geometry.blocks) ? (geometry.blocks as Array<Record<string, any>>) : [];

  const cap = SCORE_CAP[packs];
  const oldScore = finite(abs.score);
  const score = oldScore !== null && cap !== undefined ? Math.min(oldScore, cap) : oldScore;
  const lowered = oldScore !== null && score !== null && score < oldScore;

  const corrected: BojiMetric = {
    ...abs,
    score,
    values: {
      ...abs.values,
      pack_count: packs,
      blocks_image_left: packs / 2,
      blocks_image_right: packs / 2,
      engine_pack_count: enginePacks,
    },
    reasons: lowered ? [...abs.reasons, ABS_CORRECTED_REASON] : abs.reasons,
    geometry: { ...geometry, blocks: packs < enginePacks ? keepBestBlocks(blocks, packs / 2) : blocks },
  };

  const total = analysis.report.total;
  const weight = finite(total.weights_used?.abs);
  const oldTotal = finite(total.score);
  const newTotal = lowered && oldTotal !== null && weight !== null
    ? oldTotal + weight * ((score as number) - (oldScore as number))
    : oldTotal;

  return {
    ...analysis,
    report: {
      ...analysis.report,
      metrics: { ...analysis.report.metrics, abs: corrected },
      total: { ...total, score: newTotal },
    },
    messages: lowered ? { ...analysis.messages, [ABS_CORRECTED_REASON]: ABS_CORRECTED_MESSAGE } : analysis.messages,
  };
}

export interface AbsCheckConfig {
  enabled: boolean;
  /** 单次调用超时（通义 flash 关闭思考，实测 2–10 秒） */
  timeoutMs: number;
  /** 同时问几次取中位数 */
  votes: number;
}

function positive(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAbsCheckConfig(env: Record<string, string | undefined> = process.env): AbsCheckConfig {
  return {
    enabled: String(env.BOJI_AI_ABS_CHECK ?? 'on').trim().toLowerCase() !== 'off',
    timeoutMs: positive(env.BOJI_AI_ABS_TIMEOUT_MS, 15_000),
    votes: Math.floor(positive(env.BOJI_AI_ABS_VOTES, 3)),
  };
}

/** 问一次视觉模型，失败返回 null */
export type AskAbsModel = (cropBase64: string) => Promise<string | null>;

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
  // 女性档看马甲线、不数块
  if (!config.enabled || !cropBase64 || sex !== 'male' || !abs || abs.status === 'unavailable') return analysis;
  const enginePacks = finite(abs.values?.pack_count) ?? 0;
  const answers = await Promise.all(Array.from({ length: config.votes }, () => ask(cropBase64)));
  const votes = answers.map(parseAbsCount);
  const packs = medianPacks(votes);
  log(`[boji/ai-abs] engine ${enginePacks} votes [${votes.join(',')}] -> ${packs ?? 'kept'}`);
  return packs === null || packs === enginePacks ? analysis : applyAbsCount(analysis, packs);
}
