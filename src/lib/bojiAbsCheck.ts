import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';

/**
 * 薄肌检测器：用便宜的视觉大模型复核腹肌（2026-10-31 用 40 张人工标注照片选定）。
 *
 * 引擎靠亮度找横沟，纹身、皮肤起伏和光影都可能被当成腹肌，块数也常差一两块。
 * 只发检测服务裁好的腹部（不含脸），不保存；任何一步失败都保留引擎结果。
 * 1. 有没有腹肌：主模型（WANJIE_ARK_VISION_MODEL）说看不出分块或只有隐约一排，确认模型
 *    （默认 qwen3.6-flash）也这么说，才下调块数和腹肌分。
 * 2. 几块：直接问模型几乎都回答 8 块，分步数才有用，但单次不稳，所以数 3 次取中位数。
 *    标注集上引擎单独完全对 14/26，加这一步 18/26。引擎数出 0、1 块时不问。
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
/** 引擎数出的块数少于这个值时不复核：标注集上这些照片引擎都是对的，模型反而容易数多 */
const MIN_ENGINE_PACKS = 2;
/** 腹直肌每侧最多 4 行 */
const MAX_PACKS = 8;

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

export const ABS_COUNT_PROMPT = `这是一张男性腹部的裁剪照片。请一步步数腹直肌的横沟，不要凭印象给总数。

大多数人的腹肌是 6 块（3 排），8 块（4 排）比较少见，不要默认 8 块。

步骤：
1. 找到肚脐。
2. 从胸肌下沿往下到肚脐，逐条列出中线一侧能真正看到的横向凹沟，写出它们相对肚脐的位置。胸肌下沿和肋骨不算横沟。
3. 肚脐下方如果还有一条清楚的横沟，也列出来；没有就不列。
4. 排数 = 被上下两条边界（胸肌下沿、横沟、或肚脐附近的腹肌下缘）夹住、能看出隆起的肌肉块的排数。

只输出一个 JSON：
{"grooves": ["每条横沟的位置，例如 肚脐上方约三指"],
 "rows": 0 到 5 的整数,
 "definition": "none" | "faint" | "visible" | "clear",
 "confidence": 0 到 1}`;

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

/** 模型认为「没有明显分块」：看得清、有把握，而且看不出分块或只有隐约一排 */
export function saysNoDefinition(v: AbsVerdict | null): v is AbsVerdict {
  return !!v && v.visible && v.confidence >= MIN_CONFIDENCE
    && (v.definition === 'none' || (v.definition === 'faint' && v.rows <= 1));
}

/** 分步数的回答 → 块数（每排两块）；答不出返回 null */
export function parseAbsCount(text: string | null): number | null {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const rows = Number(JSON.parse(match[0]).rows);
    return Number.isInteger(rows) && rows >= 0 && rows <= 5 ? Math.min(MAX_PACKS, rows * 2) : null;
  } catch {
    return null;
  }
}

/** 至少两次有效回答才算数；两次时取较小的，三次取中位数 */
export function medianPacks(votes: Array<number | null>): number | null {
  const valid = votes.filter((v): v is number => v !== null).sort((a, b) => a - b);
  return valid.length >= 2 ? valid[Math.floor((valid.length - 1) / 2)] : null;
}

function keepBestBlocks(blocks: Array<Record<string, any>>, perSide: number): Array<Record<string, any>> {
  return (['image_left', 'image_right'] as const).flatMap((side) =>
    blocks
      .filter((b) => b?.side === side)
      .sort((a, b) => (Number(b?.enclosure) || 0) - (Number(a?.enclosure) || 0))
      .slice(0, perSide),
  );
}

/** 按模型投票改块数；少于引擎时去掉多画的块，多于引擎时只改数字（画不出新的块）。分数不变。 */
export function applyAbsCount(analysis: BojiAnalysisDto, packs: number): BojiAnalysisDto {
  const abs = analysis.report.metrics.abs;
  const enginePacks = finite(abs.values.pack_count) ?? 0;
  const geometry = abs.geometry as Record<string, unknown>;
  const blocks = Array.isArray(geometry.blocks) ? (geometry.blocks as Array<Record<string, any>>) : [];
  return {
    ...analysis,
    report: {
      ...analysis.report,
      metrics: {
        ...analysis.report.metrics,
        abs: {
          ...abs,
          values: {
            ...abs.values,
            pack_count: packs,
            blocks_image_left: packs / 2,
            blocks_image_right: packs / 2,
            engine_pack_count: enginePacks,
          },
          geometry: { ...geometry, blocks: packs < enginePacks ? keepBestBlocks(blocks, packs / 2) : blocks },
        },
      },
    },
  };
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
  const kept = keepBestBlocks(blocks, rows);
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
  /** 单次调用超时（通义 flash 关闭思考，实测 2–10 秒） */
  timeoutMs: number;
  /** 分步数的次数，0 表示不用模型定块数 */
  countVotes: number;
}

function positiveMs(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAbsCheckConfig(env: Record<string, string | undefined> = process.env): AbsCheckConfig {
  return {
    enabled: String(env.BOJI_AI_ABS_CHECK ?? 'on').trim().toLowerCase() !== 'off',
    confirmModel: env.BOJI_AI_ABS_CONFIRM_MODEL?.trim() || 'qwen3.6-flash',
    timeoutMs: positiveMs(env.BOJI_AI_ABS_TIMEOUT_MS, 15_000),
    countVotes: env.BOJI_AI_ABS_COUNT_VOTES?.trim() === '0' ? 0 : Math.floor(positiveMs(env.BOJI_AI_ABS_COUNT_VOTES, 3)),
  };
}

/** 问一次视觉模型；model 为空用主模型，prompt 为空问「有没有腹肌」。失败返回 null。 */
export type AskAbsModel = (cropBase64: string, model: string | null, prompt?: string) => Promise<string | null>;

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
  // 女性档看马甲线、不数块
  if (!config.enabled || !cropBase64 || sex !== 'male' || !abs || abs.status === 'unavailable' || enginePacks < MIN_ENGINE_PACKS) {
    return analysis;
  }
  const primary = parseAbsVerdict((await ask(cropBase64, null)) ?? '');
  if (saysNoDefinition(primary)) {
    const confirm = parseAbsVerdict((await ask(cropBase64, config.confirmModel)) ?? '');
    if (saysNoDefinition(confirm)) {
      log(`[boji/ai-abs] engine ${enginePacks} corrected to ${Math.min(primary.rows, confirm.rows)} rows (${primary.definition}/${confirm.definition})`);
      return applyAbsCorrection(analysis, [primary, confirm]);
    }
    log(`[boji/ai-abs] engine ${enginePacks} kept (confirm disagreed: ${confirm ? `${confirm.rows}/${confirm.definition}` : 'no answer'})`);
    return analysis;
  }
  if (config.countVotes <= 0) return analysis;
  const answers = await Promise.all(
    Array.from({ length: config.countVotes }, () => ask(cropBase64, null, ABS_COUNT_PROMPT)),
  );
  const votes = answers.map(parseAbsCount);
  const packs = medianPacks(votes);
  log(`[boji/ai-abs] engine ${enginePacks} votes [${votes.join(',')}] -> ${packs ?? 'kept'}`);
  // 投出 0 块不采纳：「没有腹肌」只走上面两个模型都同意的路径
  return packs !== null && packs > 0 && packs !== enginePacks ? applyAbsCount(analysis, packs) : analysis;
}
