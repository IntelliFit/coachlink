export type Gender = "Male" | "Female";

export type ExerciseType =
    | "weighted_pullup"
    | "weighted_dips"
    | "strict_press"
    | "barbell_curl"
    | "squat"
    | "bench"
    | "deadlift";

export type CalcMode = "forward" | "reverse_weight" | "reverse_reps" | "day_max";

export const isUpperBodyExercise = (type: ExerciseType) =>
    type === "weighted_pullup" || type === "weighted_dips";

export const isPowerliftingExercise = (type: ExerciseType) =>
    type === "squat" || type === "bench" || type === "deadlift";

export const isBenchBasedExercise = (type: ExerciseType) =>
    type === "strict_press" || type === "barbell_curl";

// 实力推换算系数：实力推约为卧推的65%，换算后满分500
export const STRICT_PRESS_MULTIPLIER = 500 / (130 * 0.65);

// 杠铃弯举换算系数：弯举约为卧推的50%，换算后满分500
export const BARBELL_CURL_MULTIPLIER = 500 / (130 * 0.5);

// DOTS 系数计算函数 - 用于深蹲、卧推、硬拉
// 公式: DOTS = 500 / (A*x^4 + B*x^3 + C*x^2 + D*x + E)
export function computeDOTSCoefficient(weight: number, isMale: boolean) {
    const A = isMale ? -0.000001093 : -0.0000010706;
    const B = isMale ? 0.0007391293 : 0.0005158568;
    const C = isMale ? -0.1918759221 : -0.1126655495;
    const D = isMale ? 24.0900756 : 13.6175032;
    const E = isMale ? -307.75076 : -57.96288;

    const denom = A * Math.pow(weight, 4) + B * Math.pow(weight, 3) + C * Math.pow(weight, 2) + D * weight + E;
    return 500 / denom;
}

export function computeCoefficient(
    bodyweight: number,
    formula: {
        coeff_a?: number;
        coeff_b: number;
        coeff_c: number;
        coeff_d: number;
        coeff_e: number;
        coeff_f: number;
    },
) {
    // 兼容：后端可能返回 string / null（或未来公式引入 coeff_a）
    const W = Number(bodyweight);
    if (!Number.isFinite(W)) return 0;

    const a = Number((formula as any)?.coeff_a ?? 0);
    const b = Number((formula as any)?.coeff_b ?? 0);
    const c = Number((formula as any)?.coeff_c ?? 0);
    const d = Number((formula as any)?.coeff_d ?? 0);
    const e = Number((formula as any)?.coeff_e ?? 0);
    const f = Number((formula as any)?.coeff_f ?? 0);

    const coeff = a * Math.pow(W, 5) + b * Math.pow(W, 4) + c * Math.pow(W, 3) + d * Math.pow(W, 2) + e * W + f;
    return Number.isFinite(coeff) ? coeff : 0;
}

/**
 * 单次做组里，双公式在「总做组重量 w」上的线性系数之平均（与 estimateTotal1RMFromTotalWeightAndReps 一致）。
 * 正向：1RM = w × meanFactor(reps)。逆：w = 1RM / meanFactor(reps)。
 * 注意：这不是「两个独立 1RM 再取平均」的逆，而是「先对系数取平均再乘 w」的严格代数逆。
 */
export function meanLoadFactorForReps(reps: number) {
    if (reps < 1 || reps >= 37) throw new Error("完成次数必须小于37次");
    const fE = 1 + 0.0333 * reps;
    const fB = 36 / (37 - reps);
    return (fE + fB) / 2;
}

export function estimateTotal1RMFromTotalWeightAndReps(totalWeight: number, reps: number) {
    if (reps === 1) return totalWeight;
    return totalWeight * meanLoadFactorForReps(reps);
}

/** 与 estimateTotal1RMFromTotalWeightAndReps 严格互逆（同一 w×平均系数 模型） */
export function invertTotalWeightForTarget1RM(targetTotal1RM: number, reps: number) {
    if (reps === 1) return targetTotal1RM;
    if (reps < 1 || reps >= 37) throw new Error("完成次数必须在1到36之间");
    return targetTotal1RM / meanLoadFactorForReps(reps);
}

// Continuous reps estimation (Epley-only, linear inversion) — 用于上肢引体/臂屈伸反推次数，与 streetlifting-index 一致
export function estimateRepsForTarget1RMContinuous(targetTotal1RM: number, totalWorkingWeight: number) {
    if (totalWorkingWeight <= 0 || targetTotal1RM <= 0) return 0;
    const ratio = targetTotal1RM / totalWorkingWeight;
    const rE = (ratio - 1) / 0.0333;
    return Math.max(0.1, rE);
}

/** 三大项 / 实力推 / 弯举：与正向 1RM 一致的双公式平均反推次数（streetlifting-index 同款） */
export function estimateRepsFromTotalWeightAndTarget1RM(target1RM: number, workingWeight: number) {
    const epleyReps = (target1RM / workingWeight - 1) / 0.0333;
    const brzyckiReps = 37 - (36 * workingWeight) / target1RM;
    return Math.max(1, (epleyReps + brzyckiReps) / 2);
}

export function calculateAdded1RM(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
    const adjustedWeight = addedWeight - penaltyWeight;
    const totalWeight = bodyweight + adjustedWeight;
    if (reps === 1) return adjustedWeight;
    if (reps >= 37) return 0;
    const totalEstimated1RM = totalWeight * meanLoadFactorForReps(reps);
    return totalEstimated1RM - bodyweight;
}

export function getScoreLevel(score: number, exerciseType: ExerciseType): { level: string; colorClass: string } {
    if (isPowerliftingExercise(exerciseType)) {
        if (exerciseType === "squat") {
            if (score >= 182) return { level: "🏆 世界一线", colorClass: "text-primary-700" };
            if (score >= 158) return { level: "🥇 国内一线", colorClass: "text-yellow-600" };
            if (score >= 133) return { level: "💪 大佬", colorClass: "text-blue-600" };
            if (score >= 105) return { level: "🔥 爱好者", colorClass: "text-green-600" };
            return { level: "🌱 菜就多练", colorClass: "text-surface-600" };
        }
        if (exerciseType === "bench") {
            if (score >= 130) return { level: "🏆 世界一线", colorClass: "text-primary-700" };
            if (score >= 113) return { level: "🥇 国内一线", colorClass: "text-yellow-600" };
            if (score >= 95) return { level: "💪 大佬", colorClass: "text-blue-600" };
            if (score >= 75) return { level: "🔥 爱好者", colorClass: "text-green-600" };
            return { level: "🌱 菜就多练", colorClass: "text-surface-600" };
        }
        if (exerciseType === "deadlift") {
            if (score >= 208) return { level: "🏆 世界一线", colorClass: "text-primary-700" };
            if (score >= 180) return { level: "🥇 国内一线", colorClass: "text-yellow-600" };
            if (score >= 152) return { level: "💪 大佬", colorClass: "text-blue-600" };
            if (score >= 120) return { level: "🔥 爱好者", colorClass: "text-green-600" };
            return { level: "🌱 菜就多练", colorClass: "text-surface-600" };
        }
    }

    // 500分体系（引体/臂屈伸/实力推/弯举）
    if (score >= 500) return { level: "🏆 世界级", colorClass: "text-primary-700" };
    if (score >= 450) return { level: "🥇 国内顶级", colorClass: "text-yellow-600" };
    if (score >= 400) return { level: "💪 大佬", colorClass: "text-blue-600" };
    if (score >= 300) return { level: "🔥 爱好者水平", colorClass: "text-green-600" };
    return { level: "🌱 菜就多练", colorClass: "text-surface-600" };
}

export function generateRMTable(bodyweightForTotal: number, external1rm: number) {
    const total1rm = bodyweightForTotal + external1rm;
    const repsList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
    return repsList.map((r) => {
        // invertTotalWeightForTarget1RM 与正向为严格代数互逆（w×平均系数）
        const sysWeight = invertTotalWeightForTarget1RM(total1rm, r);
        const targetLoad = sysWeight - bodyweightForTotal;
        const percentage = external1rm > 0 ? (targetLoad / external1rm) * 100 : 0;
        return {
            reps: r,
            weight: Math.round(targetLoad * 10) / 10,
            percentage: Math.round(percentage),
        };
    });
}

