export type TrainingDayLike = {
  dayIndex?: number;
  day_index?: number;
  type?: string | null;
};

export type ExecutionLike = {
  day_index: number;
  status?: string | null;
  completed_at?: string | null;
};

export function getDayIndex(day: TrainingDayLike): number {
  const di = Number((day as any)?.dayIndex ?? (day as any)?.day_index ?? 0);
  return Number.isFinite(di) ? di : 0;
}

export function isTrainingDay(day: TrainingDayLike): boolean {
  const t = (day as any)?.type;
  // historical data sometimes omitted type; treat as training by default
  return t === "training" || t === undefined || t === null || t === "";
}

export type CreditsScope = {
  scopeStartDayIndex: number;
  scopeEndDayIndex: number;
  eligibleTrainingDayIndexSet: Set<number>;
  totalCredits: number;
};

/**
 * 将可用服务周映射为当前计划的训练访问范围；次数只用于本计划展示和访问，
 * 跨计划结转以服务周为准（见 subscriptionServiceWeeks）。整周覆盖计划前 N 周，
 * 非整周按该原计划周的训练数分配，保留最后不足一次的服务份额。
 *
 * 迁移场景（线下已完成）：plan_instance.start_execution_day 表示学员已线下完成的进度起点，
 * credits 的“已消耗”会在 computeUsedCredits 里把 start_execution_day 之前的训练日计入 used。
 */
export function computeCreditsScope(params: {
  trainingDays: TrainingDayLike[];
  startExecutionDay?: number | null;
  subscribedWeeks?: number | null;
}): CreditsScope {
  const { trainingDays } = params;
  // Scope always starts from plan day 1 for subscription credits.
  const scopeStartDayIndex = 1;
  const weeks = Math.max(0, Number(params.subscribedWeeks || 0));
  if (weeks <= 0) {
    return {
      scopeStartDayIndex,
      scopeEndDayIndex: 0,
      eligibleTrainingDayIndexSet: new Set<number>(),
      totalCredits: 0,
    };
  }
  const scopeLenDays = weeks * 7;
  const rawScopeEnd = scopeStartDayIndex + Math.max(0, scopeLenDays - 1);

  // cap by plan max dayIndex (calendar span)
  const maxDayIndex = Math.max(
    0,
    ...(trainingDays || []).map((d) => getDayIndex(d)).filter((n) => n > 0),
  );
  let scopeEndDayIndex = Math.min(rawScopeEnd, maxDayIndex || rawScopeEnd);
  const wholeWeeks = Math.floor(weeks + 1e-9);
  const partialWeek = weeks - wholeWeeks;
  if (partialWeek > 1e-9) {
    const weekStart = wholeWeeks * 7;
    const partialTrainingDays = [...new Set(trainingDays.filter(isTrainingDay).map(getDayIndex)
      .filter(index => index > weekStart && index <= weekStart + 7))].sort((a, b) => a - b);
    // Keep the fractional service week. Sessions are indivisible, so the last
    // partial session remains accessible; never floor away paid service time.
    const sessions = Math.ceil(partialWeek * partialTrainingDays.length - 1e-9);
    const nextUnpaidDay = partialTrainingDays[sessions];
    scopeEndDayIndex = Math.min(maxDayIndex || weekStart + 7, nextUnpaidDay != null
      ? nextUnpaidDay - 1 : weekStart + 7);
  }

  const eligibleTrainingDayIndexSet = new Set<number>();
  for (const d of trainingDays || []) {
    const di = getDayIndex(d);
    if (!di) continue;
    if (di < scopeStartDayIndex) continue;
    if (scopeLenDays > 0 && di > scopeEndDayIndex) continue;
    if (isTrainingDay(d)) eligibleTrainingDayIndexSet.add(di);
  }

  return {
    scopeStartDayIndex,
    scopeEndDayIndex,
    eligibleTrainingDayIndexSet,
    totalCredits: eligibleTrainingDayIndexSet.size,
  };
}

export function computeUsedCredits(params: {
  eligibleTrainingDayIndexSet: Set<number>;
  executions: ExecutionLike[];
  startExecutionDay?: number | null;
}): number {
  const used = new Set<number>();
  for (const e of params.executions || []) {
    if (e?.status !== "completed") continue;
    const di = Number(e.day_index);
    if (!Number.isFinite(di)) continue;
    if (!params.eligibleTrainingDayIndexSet.has(di)) continue;
    used.add(di);
  }

  // Offline migration consumption:
  // If startExecutionDay > 1, treat eligible training days before it as already completed offline.
  const startExecutionDay = Math.max(1, Number(params.startExecutionDay || 1));
  if (startExecutionDay > 1) {
    for (const di of params.eligibleTrainingDayIndexSet) {
      if (di < startExecutionDay) used.add(di);
    }
  }

  return used.size;
}

/**
 * 将 remainingCredits 转换为“预计还需要多少自然日”用于 UI 展示。
 * 逻辑：按计划节奏（平均每周训练次数）推算。
 * - plannedCreditsPerWeek = totalCredits / cadenceWeeks
 * - remainingDays ≈ remainingCredits / plannedCreditsPerWeek * 7
 * - 如果无法推算，用 fallbackCreditsPerWeek（默认 3 次/周）
 */
export function estimateRemainingDays(params: {
  cadenceWeeks: number;
  totalCredits: number;
  remainingCredits: number;
  fallbackCreditsPerWeek?: number;
}): number {
  const weeks = Number(params.cadenceWeeks || 0);
  const total = Number(params.totalCredits || 0);
  const remaining = Number(params.remainingCredits || 0);
  const fallback = Number(params.fallbackCreditsPerWeek || 3);

  if (!Number.isFinite(weeks) || weeks <= 0) return 0;
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;

  const plannedCreditsPerWeek = total / weeks;
  const effectiveCreditsPerWeek = plannedCreditsPerWeek > 0 ? plannedCreditsPerWeek : (fallback > 0 ? fallback : 3);
  return Math.max(0, Math.ceil((remaining / effectiveCreditsPerWeek) * 7));
}
