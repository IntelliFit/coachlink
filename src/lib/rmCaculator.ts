/**
 * Epley 模型的 λ(r)
 * λ_epley(r) = 1 + 0.0333r
 */
export function lambdaEpley(r: number): number {
    if (r <= 0) throw new Error("r 必须大于 0");
    return 1 + 0.0333 * r;
}

/**
 * Brzycki 模型的 λ(r)
 * λ_brzycki(r) = 36 / (37 - r)
 */
export function lambdaBrzycki(r: number): number {
    if (r <= 0 || r >= 37) {
        throw new Error("r 必须在 (0, 37) 区间内");
    }
    return 36 / (37 - r);
}

/**
 * Lombardi 模型的 λ(r)
 * λ_lombardi(r) = r ^ 0.1
 */
export function lambdaLombardi(r: number): number {
    if (r <= 0) throw new Error("r 必须大于 0");
    return Math.pow(r, 0.1);
}

/**
 * 三模型平均 λ(r)
 *
 * λ_avg(r) =
 * (λ_epley + λ_brzycki + λ_lombardi) / 3
 */
export function lambdaAverage(r: number): number {
    const e = lambdaEpley(r);
    const b = lambdaBrzycki(r);
    const l = lambdaLombardi(r);

    return (e + b + l) / 3;
}

/**
 * 支持的 λ 模型类型
 */
export type LambdaModel =
    | "average" // 三公式平均
    | "epley"
    | "brzycki"
    | "lombardi";

/**
 * 计算推荐负重 L_r
 *
 * 公式：
 * L_r = (1RM + αW) / λ(r) - αW
 */
export function calcRecommendedLoad(
    oneRM: number,
    weight: number,
    reps: number,
    alpha: number = 1,
    model: LambdaModel = "average",
): number {
    // 负数 1RM 是有效的，表示需要辅助的自重动作
    // 例如：-10 表示需要 10kg 辅助才能完成引体向上
    if (oneRM === 0) throw new Error("1RM 不能为 0");
    if (weight <= 0) throw new Error("体重必须大于 0");

    let lambda: number;

    switch (model) {
        case "epley":
            lambda = lambdaEpley(reps);
            break;
        case "brzycki":
            lambda = lambdaBrzycki(reps);
            break;
        case "lombardi":
            lambda = lambdaLombardi(reps);
            break;
        case "average":
        default:
            lambda = lambdaAverage(reps);
    }

    const load = (oneRM + alpha * weight) / lambda - alpha * weight;

    // 允许负数结果，负数表示需要辅助训练（如引体向上用辅助带减轻自重）
    return Number(load.toFixed(2));
}

// ============ 强度描述系统扩展 ============

import type {
    CalcIntensityOptions,
    CalcIntensityResult,
    IntensityConfig,
} from "@/types/intensity";
import { normalizeToKg } from "@/types/intensity";

/**
 * RM次数转换为1RM百分比
 * 基于 Brzycki 公式: 1RM = weight × (36 / (37 - reps))
 * 反推: weight = 1RM × (37 - reps) / 36
 *
 * @param rm RM次数 (1-36)
 * @returns 对应的1RM百分比 (0-1)
 */
export function rmToPercentage(rm: number): number {
    if (rm <= 0) return 1;
    if (rm >= 37) return 0.5;
    return (37 - rm) / 36;
}

/**
 * 百分比转换为RM次数（近似）
 * 反向 Brzycki 公式: rm = 37 - 36 × percentage
 *
 * @param percentage 百分比值 (1-100)
 * @returns 对应的RM次数
 */
export function percentageToRm(percentage: number): number {
    const p = percentage / 100;
    return Math.round(37 - 36 * p);
}

/**
 * 从旧格式 params 中提取强度配置
 * 用于向后兼容
 */
export function normalizeIntensityConfig(
    params: any,
): IntensityConfig | undefined {
    // 新格式：直接返回
    if (params?.intensityConfig) {
        return params.intensityConfig;
    }

    // 旧格式：params.强度 是 RM 值
    if (params?.强度 && typeof params.强度 === "number" && params.强度 > 0) {
        return {
            relativeIntensity: {
                type: "rm",
                value: params.强度,
            },
        };
    }

    return undefined;
}

/**
 * 计算并返回强度显示值
 * 这是新的主入口函数，支持多种强度描述方式
 *
 * 优先级：
 * 1. intensityConfig.relativeIntensity + 有1RM → 计算具体重量
 * 2. intensityConfig.relativeIntensity + 无1RM → 显示文字 + 使用 recommendedLoad
 * 3. intensityConfig.recommendedLoad → 直接显示固定重量
 * 4. legacyRm（旧格式兼容）→ 按RM处理
 *
 * @param options 计算选项
 * @returns 计算结果
 */
export function calcIntensityDisplay(
    options: CalcIntensityOptions,
): CalcIntensityResult {
    const {
        intensityConfig,
        legacyRm,
        oneRM,
        bodyWeight,
        includesBodyWeight,
    } = options;

    const hasOneRM =
        oneRM !== undefined &&
        oneRM !== null &&
        Number.isFinite(oneRM) &&
        oneRM !== 0;

    // 1. 优先使用 intensityConfig
    if (intensityConfig?.relativeIntensity) {
        const ri = intensityConfig.relativeIntensity;

        // With % intensity, we can compute with 1RM alone.
        if (ri.type === "percentage" && hasOneRM) {
            const p = ri.value / 100;

            // NOTE:
            // - oneRM in this product is "external load 1RM" (不含自重) even for pull-ups/dips.
            // - For includesBodyWeight actions, % should be applied to TOTAL (bw + external) then subtract bw.
            if (includesBodyWeight) {
                if (bodyWeight <= 0) {
                    // can't compute external load without body weight
                    if (intensityConfig.recommendedLoad) {
                        return {
                            displayWeight: intensityConfig.recommendedLoad.value,
                            displayUnit: intensityConfig.recommendedLoad.unit,
                            displayText: `${ri.value}%`,
                            source: "recommended",
                        };
                    }
                    return { displayText: `${ri.value}%`, source: "relative-text" };
                }

                const total1RM = oneRM + bodyWeight;
                const totalTarget = total1RM * p;
                const displayWeight = totalTarget - bodyWeight;
                return {
                    displayWeight: Math.round(displayWeight * 10) / 10,
                    displayUnit: "kg",
                    source: "calculated",
                };
            }

            // normal actions: % applies to external 1RM directly
            const displayWeight = oneRM * p;
            return {
                displayWeight: Math.round(displayWeight * 10) / 10,
                displayUnit: "kg",
                source: "calculated",
            };
        }

        // With RM intensity, body weight is only required for bodyweight-including movements.
        if (ri.type === "rm" && hasOneRM && (!includesBodyWeight || bodyWeight > 0)) {
            const percentage = rmToPercentage(ri.value);

            // See note above: for includesBodyWeight, compute on TOTAL weight.
            const displayWeight = includesBodyWeight
                ? ((oneRM + bodyWeight) * percentage - bodyWeight)
                : (oneRM * percentage);

            return {
                displayWeight: Math.round(displayWeight * 10) / 10,
                displayUnit: "kg",
                source: "calculated",
            };
        }

        {
            // 无1RM，显示相对强度文字
            const text = ri.type === "rm" ? `${ri.value}RM` : `${ri.value}%`;

            // 尝试使用推荐数值作为备选显示
            if (intensityConfig.recommendedLoad) {
                const load = intensityConfig.recommendedLoad;
                return {
                    displayWeight: load.value,
                    displayUnit: load.unit,
                    displayText: text, // 同时保留相对强度文字
                    source: "recommended",
                };
            }

            return {
                displayText: text,
                source: "relative-text",
            };
        }
    }

    // 2. 使用推荐数值
    if (intensityConfig?.recommendedLoad) {
        const load = intensityConfig.recommendedLoad;
        return {
            displayWeight: load.value,
            displayUnit: load.unit,
            source: "recommended",
        };
    }

    // 3. 旧格式兼容：使用 legacyRm（原 params.强度）
    if (legacyRm && legacyRm > 0) {
        if (hasOneRM) {
            // For non-bodyweight actions, compute without requiring bodyWeight.
            if (!includesBodyWeight) {
                const percentage = rmToPercentage(legacyRm);
                const calculatedWeight = oneRM * percentage;
                return {
                    displayWeight: Math.round(calculatedWeight * 10) / 10,
                    displayUnit: "kg",
                    source: "calculated",
                };
            }

            // For bodyweight actions, need body weight to compute external load correctly.
            if (bodyWeight > 0) {
                const calculatedWeight = calcRecommendedLoad(
                    oneRM,
                    bodyWeight,
                    legacyRm,
                    1,
                    "average",
                );

                return {
                    displayWeight: calculatedWeight,
                    displayUnit: "kg",
                    source: "calculated",
                };
            }
        }

        {
            return {
                displayText: `${legacyRm}RM`,
                source: "relative-text",
            };
        }
    }

    // 4. 无任何强度配置
    return { source: "none" };
}
