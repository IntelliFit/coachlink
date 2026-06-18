import {
  BARBELL_CURL_MULTIPLIER,
  STRICT_PRESS_MULTIPLIER,
  computeCoefficient,
  computeDOTSCoefficient,
  estimateRepsForTarget1RMContinuous,
  estimateRepsFromTotalWeightAndTarget1RM,
  estimateTotal1RMFromTotalWeightAndReps,
  getScoreLevel,
  invertTotalWeightForTarget1RM,
  isBenchBasedExercise,
  isPowerliftingExercise,
  isUpperBodyExercise,
  type CalcMode,
  type ExerciseType,
  type Gender,
} from "@/app/streetlifting-index/_utils";

export type RestCat = "short" | "moderate" | "long" | "very_long";
export type SetFeedbackType = "RIR" | "Achieved";
export type FormQuality = "Competition" | "Minor_Cheat" | "Major_Cheat" | "Extreme_Cheat";
export type SourceSurface = "web" | "weapp";

export type StreetliftingFormulaLike = {
  coeff_a?: number | null;
  coeff_b: number | string;
  coeff_c: number | string;
  coeff_d: number | string;
  coeff_e: number | string;
  coeff_f: number | string;
};

export type StreetliftingCalculatorRequest = {
  sourceSurface: SourceSurface;
  exerciseType: ExerciseType;
  mode: CalcMode;
  gender: Gender;
  bodyweight: number;
  addedWeight?: number | null;
  added1RM?: number | null;
  workingAddedWeight?: number | null;
  liftWeight?: number | null;
  target1RM?: number | null;
  workingLiftWeight?: number | null;
  reps?: number | null;
  sets?: number | null;
  restCat?: RestCat | null;
  dayFirstType?: SetFeedbackType | null;
  dayFirstValue?: number | null;
  dayLastType?: SetFeedbackType | null;
  dayLastValue?: number | null;
  formQuality: FormQuality;
  penaltyWeight?: number | null;
};

export type StreetliftingCalculatorResult = {
  estimated1RMKg: number;
  finalScore: number;
  coefficient: number;
  computedAddedWeightKg?: number | null;
  computedReps?: number | null;
  adjustedUsedWeightKg?: number | null;
  resultLevel: string;
  isRankingEligible: boolean;
};

export function getPenaltyWeight(formQuality: FormQuality, penaltyWeight?: number | null) {
  if (formQuality === "Competition") return 0;
  return Math.max(0, Number(penaltyWeight || 0));
}

function restMultiplier(cat: RestCat) {
  switch (cat) {
    case "short":
      return 1.6;
    case "moderate":
      return 1.25;
    case "long":
      return 1.0;
    case "very_long":
      return 0.85;
    default:
      return 1.0;
  }
}

function intensityAvg(reps: number) {
  const r = Math.max(1, Math.min(36, Math.round(reps)));
  const e = 1 / (1 + 0.0333 * r);
  const b = (37 - r) / 36;
  const l = Math.pow(r, -0.1);
  return (e + b + l) / 3;
}

function estimateDayMaxFromSets(params: {
  bodyweight: number;
  addedWeight: number;
  penaltyWeight: number;
  sets: number;
  reps: number;
  restCat: RestCat;
  firstSet?: { type: SetFeedbackType; value: number };
  lastSet?: { type: SetFeedbackType; value: number };
  alphaPerRep?: number;
}) {
  const {
    bodyweight,
    addedWeight,
    penaltyWeight,
    sets,
    reps,
    restCat,
    firstSet,
    lastSet,
    alphaPerRep = 0.004,
  } = params;

  const adjustedAdded = addedWeight - penaltyWeight;
  const totalWorkingWeight = bodyweight + adjustedAdded;
  if (!Number.isFinite(totalWorkingWeight) || totalWorkingWeight <= 0) {
    throw new Error("输入导致总重量无效");
  }

  const fatigueMultiplier = restMultiplier(restCat);
  const beta = alphaPerRep * reps * fatigueMultiplier;
  const lastAvail = Math.max(0.75, 1 - (sets - 1) * beta);

  const effectiveReps = (input?: { type: SetFeedbackType; value: number }) => {
    if (!input) return null;
    const value = input.type === "RIR" ? reps + input.value : input.value;
    return Math.max(1, Math.min(36, value));
  };

  const firstSetReps = effectiveReps(firstSet);
  const lastSetReps = effectiveReps(lastSet);

  let firstEstimate: number | null = null;
  let lastEstimate: number | null = null;

  if (firstSetReps !== null) {
    firstEstimate = totalWorkingWeight / intensityAvg(firstSetReps);
  }
  if (lastSetReps !== null) {
    lastEstimate = totalWorkingWeight / (intensityAvg(lastSetReps) * lastAvail);
  }

  let day1RM: number;
  if (firstEstimate !== null && lastEstimate !== null) {
    day1RM = firstEstimate * 0.8 + lastEstimate * 0.2;
  } else if (firstEstimate !== null) {
    day1RM = firstEstimate;
  } else if (lastEstimate !== null) {
    day1RM = lastEstimate;
  } else {
    throw new Error("请至少输入第一组或最后一组的信息");
  }

  return {
    total1RM: day1RM,
    added1RM: day1RM - bodyweight,
  };
}

function toFiniteNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function requirePositive(value: unknown, message: string) {
  const n = toFiniteNumber(value);
  if (n === null || n <= 0) throw new Error(message);
  return n;
}

function requireReps(value: unknown, message = "完成次数必须在 1-36 之间") {
  const n = toFiniteNumber(value);
  if (n === null || n < 1 || n > 36) throw new Error(message);
  return n;
}

export function buildStreetliftingRankingBucketTitle(params: {
  exerciseType: ExerciseType;
  gender: Gender;
}) {
  const actionNameMap: Record<ExerciseType, string> = {
    weighted_pullup: "负重引体",
    weighted_dips: "负重双杠臂屈伸",
    strict_press: "实力推",
    barbell_curl: "杠铃弯举",
    squat: "深蹲",
    bench: "卧推",
    deadlift: "硬拉",
  };
  const genderLabel = params.gender === "Male" ? "男子" : "女子";
  return `${genderLabel}${actionNameMap[params.exerciseType]}趣味榜`;
}

export function computeStreetliftingCalculatorResult(
  request: StreetliftingCalculatorRequest,
  options?: { formula?: StreetliftingFormulaLike | null }
): StreetliftingCalculatorResult {
  const {
    exerciseType,
    mode,
    gender,
    bodyweight,
    formQuality,
  } = request;

  if (!gender || (gender !== "Male" && gender !== "Female")) {
    throw new Error("请填写有效的性别");
  }

  const bw = requirePositive(bodyweight, "请填写有效的体重");
  const penalty = getPenaltyWeight(formQuality, request.penaltyWeight);
  const isMale = gender === "Male";

  let result: Omit<StreetliftingCalculatorResult, "resultLevel" | "isRankingEligible">;

  if (isPowerliftingExercise(exerciseType)) {
    const coefficient = computeDOTSCoefficient(bw, isMale);

    if (mode === "forward") {
      const workingWeight = requirePositive(request.liftWeight, "请填写有效的做组重量");
      const reps = requirePositive(request.reps, "请填写有效的完成次数");
      const adjusted = workingWeight - penalty;
      if (adjusted <= 0) throw new Error("惩罚重量过高，调整后的重量必须大于 0");
      const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps);
      result = {
        estimated1RMKg: estimated1RM,
        finalScore: estimated1RM * coefficient,
        coefficient,
        adjustedUsedWeightKg: adjusted,
      };
    } else if (mode === "reverse_weight") {
      const target1RM = requirePositive(request.target1RM, "请填写有效的现有 1RM");
      const reps = requirePositive(request.reps, "请填写有效的完成次数");
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient,
        coefficient,
        computedAddedWeightKg: invertTotalWeightForTarget1RM(target1RM, reps),
      };
    } else if (mode === "reverse_reps") {
      const target1RM = requirePositive(request.target1RM, "请填写有效的现有 1RM");
      const workingWeight = requirePositive(request.workingLiftWeight, "请填写有效的做组重量");
      if (workingWeight >= target1RM) throw new Error("做组重量必须小于 1RM");
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient,
        coefficient,
        computedReps: Number(estimateRepsFromTotalWeightAndTarget1RM(target1RM, workingWeight).toFixed(1)),
        adjustedUsedWeightKg: workingWeight,
      };
    } else {
      throw new Error("三大项不支持做组极限估算");
    }
  } else if (isBenchBasedExercise(exerciseType)) {
    const coefficient = computeDOTSCoefficient(bw, isMale);
    const multiplier = exerciseType === "strict_press" ? STRICT_PRESS_MULTIPLIER : BARBELL_CURL_MULTIPLIER;

    if (mode === "forward") {
      const workingWeight = requirePositive(request.liftWeight, "请填写有效的做组重量");
      const reps = requirePositive(request.reps, "请填写有效的完成次数");
      const adjusted = workingWeight - penalty;
      if (adjusted <= 0) throw new Error("惩罚重量过高，调整后的重量必须大于 0");
      const estimated1RM = estimateTotal1RMFromTotalWeightAndReps(adjusted, reps);
      result = {
        estimated1RMKg: estimated1RM,
        finalScore: estimated1RM * coefficient * multiplier,
        coefficient,
        adjustedUsedWeightKg: adjusted,
      };
    } else if (mode === "reverse_weight") {
      const target1RM = requirePositive(request.target1RM, "请填写有效的现有 1RM");
      const reps = requirePositive(request.reps, "请填写有效的完成次数");
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient * multiplier,
        coefficient,
        computedAddedWeightKg: invertTotalWeightForTarget1RM(target1RM, reps),
      };
    } else if (mode === "reverse_reps") {
      const target1RM = requirePositive(request.target1RM, "请填写有效的现有 1RM");
      const workingWeight = requirePositive(request.workingLiftWeight, "请填写有效的做组重量");
      if (workingWeight >= target1RM) throw new Error("做组重量必须小于 1RM");
      result = {
        estimated1RMKg: target1RM,
        finalScore: target1RM * coefficient * multiplier,
        coefficient,
        computedReps: Number(estimateRepsFromTotalWeightAndTarget1RM(target1RM, workingWeight).toFixed(1)),
        adjustedUsedWeightKg: workingWeight,
      };
    } else {
      throw new Error("该动作不支持做组极限估算");
    }
  } else {
    if (!isUpperBodyExercise(exerciseType)) {
      throw new Error("未知运动类型");
    }
    const formula = options?.formula;
    if (!formula) {
      throw new Error("未找到对应公式");
    }
    const coefficient = computeCoefficient(bw, formula);

    if (mode === "forward") {
      const added = requirePositive(request.addedWeight, "请填写附加负重");
      const reps = requireReps(request.reps);
      const adjustedAdded = added - penalty;
      const totalWorkingWeight = bw + adjustedAdded;
      if (totalWorkingWeight <= 0) throw new Error("惩罚重量过高，导致总重量无效");
      const total1RM = estimateTotal1RMFromTotalWeightAndReps(totalWorkingWeight, reps);
      const added1RM = total1RM - bw;
      const rawScore = total1RM * coefficient;
      result = {
        estimated1RMKg: added1RM,
        finalScore: exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore,
        coefficient,
        adjustedUsedWeightKg: adjustedAdded,
      };
    } else if (mode === "reverse_weight") {
      const existingAdded1RM = requirePositive(request.added1RM, "请填写负重 1RM");
      const reps = requireReps(request.reps);
      const targetTotal1RM = bw + existingAdded1RM;
      const totalWorkingWeight = invertTotalWeightForTarget1RM(targetTotal1RM, reps);
      const adjustedAdded = totalWorkingWeight - bw;
      const rawScore = targetTotal1RM * coefficient;
      result = {
        estimated1RMKg: existingAdded1RM,
        finalScore: exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore,
        coefficient,
        computedAddedWeightKg: adjustedAdded + penalty,
        adjustedUsedWeightKg: adjustedAdded,
      };
    } else if (mode === "reverse_reps") {
      const existingAdded1RM = requirePositive(request.added1RM, "请填写负重 1RM");
      const workingAdded = requirePositive(request.workingAddedWeight, "请填写做组重量（附加负重）");
      const targetTotal1RM = bw + existingAdded1RM;
      const adjustedAdded = workingAdded - penalty;
      const totalWorkingWeight = bw + adjustedAdded;
      if (totalWorkingWeight <= 0) throw new Error("输入导致总重量无效");
      const rawScore = targetTotal1RM * coefficient;
      result = {
        estimated1RMKg: existingAdded1RM,
        finalScore: exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore,
        coefficient,
        computedReps: Number(estimateRepsForTarget1RMContinuous(targetTotal1RM, totalWorkingWeight).toFixed(1)),
        adjustedUsedWeightKg: adjustedAdded,
      };
    } else if (mode === "day_max") {
      const setCount = requirePositive(request.sets, "请填写有效的组数");
      const reps = requirePositive(request.reps, "请填写有效的每组次数");
      const added = requirePositive(request.addedWeight, "请填写做组重量（附加负重）");
      const firstSet = request.dayFirstType && toFiniteNumber(request.dayFirstValue) !== null
        ? { type: request.dayFirstType, value: Number(request.dayFirstValue) }
        : undefined;
      const lastSet = request.dayLastType && toFiniteNumber(request.dayLastValue) !== null
        ? { type: request.dayLastType, value: Number(request.dayLastValue) }
        : undefined;
      if (!firstSet && !lastSet) {
        throw new Error("请至少输入第一组或最后一组的信息");
      }
      const { total1RM, added1RM } = estimateDayMaxFromSets({
        bodyweight: bw,
        addedWeight: added,
        penaltyWeight: penalty,
        sets: setCount,
        reps,
        restCat: request.restCat || "long",
        firstSet,
        lastSet,
      });
      const rawScore = total1RM * coefficient;
      result = {
        estimated1RMKg: added1RM,
        finalScore: exerciseType === "weighted_dips" ? rawScore / 1.3 : rawScore,
        coefficient,
        adjustedUsedWeightKg: added - penalty,
      };
    } else {
      throw new Error("未知计算模式");
    }
  }

  const resultLevel = getScoreLevel(result.finalScore, exerciseType).level.replace(/^[^\u4e00-\u9fa5A-Za-z]+/u, "").trim();
  const isRankingEligible = mode === "forward";

  return {
    ...result,
    resultLevel,
    isRankingEligible,
  };
}
