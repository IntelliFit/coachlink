import type { AutomationPolicy, AutomationRiskLevel, FeedbackPatchResult } from "./types";

const HIGH_RISK_PATTERNS = [
  /疼|痛|伤|拉伤|扭伤|刺痛|麻|麻木|头晕|胸闷|恶心|晕|肿|炎|无法完成|不能继续/,
  /injury|injured|pain|numb|dizzy|swollen|strain|sprain/i,
];

const MEDIUM_RISK_PATTERNS = [
  /太累|疲劳|恢复差|睡眠差|状态差|连续失败|失败很多|压力大|不适/,
  /fatigue|tired|recovery|failed|stress/i,
];

function classifyRisk(content: string, difficultyRating?: number | null): AutomationRiskLevel {
  const text = String(content || "");
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(text))) return "high";
  if (difficultyRating && difficultyRating >= 5) return "medium";
  if (MEDIUM_RISK_PATTERNS.some((pattern) => pattern.test(text))) return "medium";
  return "low";
}

function directionFromFeedback(content: string, difficultyRating?: number | null): "reduce" | "increase" | "time" | "note" {
  const text = String(content || "");
  if (/时间不够|没时间|太久|来不及|time/i.test(text)) return "time";
  if (/太轻|简单|轻松|不累|easy|light/i.test(text) || (difficultyRating && difficultyRating <= 2)) return "increase";
  if (/太重|太难|吃力|累|难|hard|heavy/i.test(text) || (difficultyRating && difficultyRating >= 4)) return "reduce";
  return "note";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function adjustSetParams(params: Record<string, any>, direction: "reduce" | "increase" | "time") {
  const next = params;
  const sets = toNumber(next.sets ?? next["组数"]);
  const reps = toNumber(next.reps ?? next["次数"]);

  if (direction === "time" || direction === "reduce") {
    if (sets !== null && sets > 1) {
      next.sets = Math.max(1, sets - 1);
      next["组数"] = next.sets;
      return true;
    }
    if (reps !== null && reps > 1) {
      next.reps = Math.max(1, Math.round(reps * 0.9));
      next["次数"] = next.reps;
      return true;
    }
  }

  if (direction === "increase") {
    if (reps !== null && reps > 0) {
      next.reps = Math.max(1, Math.round(reps * 1.05));
      next["次数"] = next.reps;
      return true;
    }
    if (sets !== null && sets > 0) {
      next.sets = sets + 1;
      next["组数"] = next.sets;
      return true;
    }
  }

  next.note = [next.note, "根据本次反馈，后续训练请教练复核强度安排。"].filter(Boolean).join(" ");
  return true;
}

export function buildFeedbackAdjustmentPatch(params: {
  trainingDays: any[];
  feedbackContent: string;
  difficultyRating?: number | null;
  feedbackDayIndex: number;
  blockedDayIndexes?: number[];
  policy: AutomationPolicy;
}): FeedbackPatchResult {
  const riskLevel = classifyRisk(params.feedbackContent, params.difficultyRating);
  const direction = directionFromFeedback(params.feedbackContent, params.difficultyRating);
  const requiresCoachReview =
    riskLevel === "high" ||
    params.policy.feedbackAdjustmentMode === "draft_notify" ||
    params.policy.feedbackAdjustmentMode === "off";

  if (riskLevel === "high") {
    return {
      riskLevel,
      requiresCoachReview: true,
      summary: "反馈包含疼痛、伤病或明显安全风险，系统仅生成提醒，不自动修改计划。",
      proposedPatch: {
        kind: "safety_review",
        feedback: params.feedbackContent,
        recommendation: "请教练先与学员确认身体状态，再决定是否调整训练安排。",
      },
    };
  }

  const updatedTrainingDays = JSON.parse(JSON.stringify(params.trainingDays || []));
  const blockedDayIndexes = new Set(
    (params.blockedDayIndexes || [])
      .map((value) => Number(value || 0))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  let changed = 0;

  for (const day of updatedTrainingDays) {
    const dayIndex = Number(day?.dayIndex || day?.day_index || 0);
    if (!dayIndex || dayIndex <= params.feedbackDayIndex) continue;
    if (blockedDayIndexes.has(dayIndex)) continue;
    if (!Array.isArray(day?.actionSets)) continue;

    for (const actionSet of day.actionSets) {
      if (changed >= 4) break;
      const nextParams = { ...(actionSet.params || {}) };
      if (direction === "note") {
        nextParams.note = [nextParams.note, "根据最近反馈，请留意主观疲劳和动作质量。"].filter(Boolean).join(" ");
        actionSet.params = nextParams;
        changed++;
        continue;
      }
      if (adjustSetParams(nextParams, direction)) {
        actionSet.params = nextParams;
        changed++;
      }
    }
    if (changed >= 4) break;
  }

  const summary =
    changed > 0
      ? direction === "increase"
        ? "根据反馈，已为未来训练生成小幅增加容量/次数的调整草稿。"
        : direction === "time"
          ? "根据时间不足反馈，已为未来训练生成压缩训练量的调整草稿。"
          : direction === "reduce"
            ? "根据偏难或疲劳反馈，已为未来训练生成降低容量的调整草稿。"
            : "根据反馈，已为未来训练生成备注型调整草稿。"
      : "系统未找到适合自动改动的未来训练项，仅生成教练复核建议。";

  return {
    riskLevel,
    summary,
    updatedTrainingDays: changed > 0 ? updatedTrainingDays : undefined,
    proposedPatch: {
      kind: "training_days_patch",
      direction,
      changedFutureItems: changed,
      updatedTrainingDays: changed > 0 ? updatedTrainingDays : null,
    },
    requiresCoachReview,
  };
}
