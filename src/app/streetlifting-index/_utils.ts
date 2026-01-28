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
        coeff_b: number;
        coeff_c: number;
        coeff_d: number;
        coeff_e: number;
        coeff_f: number;
    },
) {
    const W = bodyweight;
    return (
        formula.coeff_b * Math.pow(W, 4) +
        formula.coeff_c * Math.pow(W, 3) +
        formula.coeff_d * Math.pow(W, 2) +
        formula.coeff_e * W +
        formula.coeff_f
    );
}

export function estimateTotal1RMFromTotalWeightAndReps(totalWeight: number, reps: number) {
    if (reps === 1) return totalWeight;
    if (reps >= 37) throw new Error("完成次数必须小于37次");
    const epley1RM = totalWeight * (1 + 0.0333 * reps);
    const brzycki1RM = totalWeight * (36 / (37 - reps));
    const lombardi1RM = totalWeight * Math.pow(reps, 0.1);
    return (epley1RM + brzycki1RM + lombardi1RM) / 3;
}

export function invertTotalWeightForTarget1RM(targetTotal1RM: number, reps: number) {
    if (reps === 1) return targetTotal1RM;
    if (reps < 1 || reps >= 37) throw new Error("完成次数必须在1到36之间");
    const wtE = targetTotal1RM / (1 + 0.0333 * reps);
    const wtB = targetTotal1RM * ((37 - reps) / 36);
    const wtL = targetTotal1RM / Math.pow(reps, 0.1);
    return (wtE + wtB + wtL) / 3;
}

// Continuous reps estimation (Epley-only, linear inversion)
export function estimateRepsForTarget1RMContinuous(targetTotal1RM: number, totalWorkingWeight: number) {
    if (totalWorkingWeight <= 0 || targetTotal1RM <= 0) return 0;
    const ratio = targetTotal1RM / totalWorkingWeight;
    const rE = (ratio - 1) / 0.0333;
    return Math.max(0.1, rE);
}

export function calculateAdded1RM(bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) {
    const adjustedWeight = addedWeight - penaltyWeight;
    const totalWeight = bodyweight + adjustedWeight;
    if (reps === 1) return adjustedWeight;
    if (reps >= 37) return 0;
    const epley1RM = totalWeight * (1 + 0.0333 * reps);
    const brzycki1RM = totalWeight * (36 / (37 - reps));
    const lombardi1RM = totalWeight * Math.pow(reps, 0.1);
    const totalEstimated1RM = (epley1RM + brzycki1RM + lombardi1RM) / 3;
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
        const factorEpley = (1 + 0.0333) / (1 + 0.0333 * r);
        const factorBrzycki = (37 - r) / 36.0;
        const factorLombardi = 1 / Math.pow(r, 0.1);
        const avgFactor = (factorEpley + factorBrzycki + factorLombardi) / 3.0;
        const sysWeight = total1rm * avgFactor;
        const targetLoad = sysWeight - bodyweightForTotal;
        const percentage = external1rm > 0 ? (targetLoad / external1rm) * 100 : 0;
        return {
            reps: r,
            weight: Math.round(targetLoad * 10) / 10,
            percentage: Math.round(percentage),
        };
    });
}

