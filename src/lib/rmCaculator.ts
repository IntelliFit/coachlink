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
    // 1RM = 0 在数学上也是合法的：
    // - 对于不包含自重的动作（α=0）：结果就是 0
    // - 对于包含自重的动作（α=1）：结果是 W/λ(r) - W，可能为负数（表示需要辅助）
    // alpha=0 表示不考虑体重项（纯外加重量动作），此时允许 weight<=0
    if (alpha !== 0 && weight <= 0) throw new Error("体重必须大于 0");

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
    FixedWeightLoad,
    IntensityConfig,
    RecommendedLoad,
    RelativeIntensity,
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

function finitePositiveNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeIntensityText(value: string): string {
    return value
        .trim()
        .replace(/％/g, "%")
        .replace(/\s+/g, "")
        .toLowerCase();
}

function parseLegacyRelativeIntensity(
    value: unknown,
): RelativeIntensity | undefined {
    const numericValue = finitePositiveNumber(value);
    if (numericValue !== null) {
        return { type: "rm", value: numericValue };
    }

    if (typeof value !== "string") return undefined;

    const text = normalizeIntensityText(value).replace(/^@/, "");
    const percentageMatch = text.match(/^(\d+(?:\.\d+)?)%(?:1?rm)?$/);
    if (percentageMatch) {
        const percentage = finitePositiveNumber(percentageMatch[1]);
        return percentage !== null
            ? { type: "percentage", value: percentage }
            : undefined;
    }

    const rmMatch = text.match(/^(\d+(?:\.\d+)?)rm$/);
    if (rmMatch) {
        const rm = finitePositiveNumber(rmMatch[1]);
        return rm !== null ? { type: "rm", value: rm } : undefined;
    }

    const plainNumberMatch = text.match(/^(\d+(?:\.\d+)?)$/);
    if (plainNumberMatch) {
        const rm = finitePositiveNumber(plainNumberMatch[1]);
        return rm !== null ? { type: "rm", value: rm } : undefined;
    }

    return undefined;
}

function normalizeRelativeIntensity(input: unknown): RelativeIntensity | undefined {
    if (!input || typeof input !== "object") return undefined;
    const relative = input as { type?: unknown; value?: unknown };
    const parsed = parseLegacyRelativeIntensity(relative.value);
    if (!parsed) return undefined;

    if (relative.type === "percentage") {
        return { type: "percentage", value: parsed.value };
    }
    if (relative.type === "rm") {
        return { type: "rm", value: parsed.value };
    }

    return parsed;
}

function normalizeWeightLoad(input: unknown): RecommendedLoad | FixedWeightLoad | undefined {
    if (!input || typeof input !== "object") return undefined;
    const load = input as { value?: unknown; unit?: unknown };
    const value = Number(load.value);
    if (!Number.isFinite(value)) return undefined;
    return {
        value,
        unit: load.unit === "lbs" ? "lbs" : "kg",
    };
}

function normalizeExistingIntensityConfig(
    intensityConfig: unknown,
): IntensityConfig | undefined {
    if (!intensityConfig || typeof intensityConfig !== "object") return undefined;
    const raw = intensityConfig as IntensityConfig;
    const next: IntensityConfig = {};

    const relativeIntensity = normalizeRelativeIntensity(raw.relativeIntensity);
    if (relativeIntensity) {
        next.relativeIntensity = relativeIntensity;
    }

    const fixedWeight = normalizeWeightLoad(raw.fixedWeight);
    if (fixedWeight) {
        next.fixedWeight = fixedWeight;
    }

    const recommendedLoad = normalizeWeightLoad(raw.recommendedLoad);
    if (recommendedLoad) {
        next.recommendedLoad = recommendedLoad;
    }

    return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * 从旧格式 params 中提取强度配置
 * 用于向后兼容
 */
export function normalizeIntensityConfig(
    params: any,
): IntensityConfig | undefined {
    // 新格式：先标准化，避免历史数据里 value 是 "70%1RM" 这类字符串。
    if (params?.intensityConfig) {
        const normalized = normalizeExistingIntensityConfig(params.intensityConfig);
        if (normalized) return normalized;
    }

    // 旧格式：params.强度 可能是数字 RM，也可能是 "70%1RM" / "70%rm"。
    const legacyRelativeIntensity = parseLegacyRelativeIntensity(params?.强度);
    if (legacyRelativeIntensity) {
        return {
            relativeIntensity: legacyRelativeIntensity,
        };
    }

    const rawFixedLoad = params?.load ?? params?.weight ?? params?.intensityConfig?.fixedWeight?.value;
    if (rawFixedLoad !== null && rawFixedLoad !== undefined && rawFixedLoad !== "") {
        const fixedLoad = Number(rawFixedLoad);
        if (!Number.isFinite(fixedLoad)) {
            return undefined;
        }
        return {
            fixedWeight: {
                value: fixedLoad,
                unit: params?.loadUnit === "lbs" ? "lbs" : "kg",
            },
        };
    }

    return undefined;
}

/**
 * 判断当前动作是否属于“动态强度”口径（RM/%）。
 * - 动态强度：需要随 1RM 变化重算推荐重量。
 * - 固定重量：应保留计划中手动设置的 load。
 */
export function hasDynamicIntensityTarget(options: {
    intensityConfig?: IntensityConfig;
    legacyRm?: number | string | null;
}): boolean {
    const { intensityConfig, legacyRm } = options;
    const ri = normalizeExistingIntensityConfig(intensityConfig)?.relativeIntensity;
    if (ri && (ri.type === "rm" || ri.type === "percentage")) {
        const v = Number(ri.value);
        if (Number.isFinite(v) && v > 0) return true;
    }

    return !!parseLegacyRelativeIntensity(legacyRm);
}

/**
 * 计算并返回强度显示值
 * 这是新的主入口函数，支持多种强度描述方式
 *
 * 优先级：
 * 1. intensityConfig.relativeIntensity + 有1RM → 计算具体重量
 * 2. intensityConfig.relativeIntensity + 无1RM → 显示文字 + 使用 recommendedLoad
 * 3. intensityConfig.fixedWeight → 直接显示固定重量
 * 4. intensityConfig.recommendedLoad → 显示推荐重量
 * 5. legacyRm（旧格式兼容）→ 按RM处理
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

    // 1RM = 0 在数学上是合法的（对于不包含自重的动作，结果就是 0）
    // 只有 null/undefined/非有限数才表示未设置
    const hasOneRM =
        oneRM !== undefined &&
        oneRM !== null &&
        Number.isFinite(oneRM);

    const normalizedIntensityConfig = normalizeExistingIntensityConfig(intensityConfig);
    const legacyRelativeIntensity = parseLegacyRelativeIntensity(legacyRm);

    // 1. 优先使用 intensityConfig
    if (normalizedIntensityConfig?.relativeIntensity) {
        const ri = normalizedIntensityConfig.relativeIntensity;

        // With % intensity, we can compute with 1RM alone.
        if (ri.type === "percentage" && hasOneRM) {
            const p = ri.value / 100;

            // NOTE:
            // - oneRM in this product is "external load 1RM" (不含自重) even for pull-ups/dips.
            // - Product rule: percentage mode uses external 1RM directly (no body-weight subtraction).
            const displayWeight = oneRM * p;
            return {
                displayWeight: Math.round(displayWeight * 10) / 10,
                displayUnit: "kg",
                source: "calculated",
            };
        }

        // With RM intensity, body weight is only required for bodyweight-including movements.
        if (ri.type === "rm" && hasOneRM && (!includesBodyWeight || bodyWeight > 0)) {
            // Keep the original product rule:
            // - non-bodyweight actions: use simple Brzycki-derived percentage mapping
            // - bodyweight-including actions: use calcRecommendedLoad (3-formula average)
            if (!includesBodyWeight) {
                const percentage = rmToPercentage(ri.value);
                const displayWeight = oneRM * percentage;
                return {
                    displayWeight: Math.round(displayWeight * 10) / 10,
                    displayUnit: "kg",
                    source: "calculated",
                };
            }

            const displayWeight = calcRecommendedLoad(
                oneRM,
                bodyWeight,
                ri.value,
                1,
                "average",
            );
            return {
                displayWeight,
                displayUnit: "kg",
                source: "calculated",
            };
        }

        {
            // 无1RM，显示相对强度文字
            const text = ri.type === "rm" ? `${ri.value}RM` : `${ri.value}%`;

            // 尝试使用推荐数值作为备选显示
            if (normalizedIntensityConfig.recommendedLoad) {
                const load = normalizedIntensityConfig.recommendedLoad;
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

    // 2. 使用固定重量
    if (normalizedIntensityConfig?.fixedWeight) {
        const load = normalizedIntensityConfig.fixedWeight;
        return {
            displayWeight: load.value,
            displayUnit: load.unit,
            source: "recommended",
        };
    }

    // 3. 使用推荐数值
    if (normalizedIntensityConfig?.recommendedLoad) {
        const load = normalizedIntensityConfig.recommendedLoad;
        return {
            displayWeight: load.value,
            displayUnit: load.unit,
            source: "recommended",
        };
    }

    // 4. 旧格式兼容：使用 legacyRm（原 params.强度）
    if (legacyRelativeIntensity) {
        if (legacyRelativeIntensity.type === "percentage") {
            if (hasOneRM) {
                const displayWeight = oneRM * (legacyRelativeIntensity.value / 100);
                return {
                    displayWeight: Math.round(displayWeight * 10) / 10,
                    displayUnit: "kg",
                    source: "calculated",
                };
            }

            return {
                displayText: `${legacyRelativeIntensity.value}%`,
                source: "relative-text",
            };
        }

        const legacyRmValue = legacyRelativeIntensity.value;
        if (hasOneRM) {
            // For non-bodyweight actions, compute without requiring bodyWeight.
            if (!includesBodyWeight) {
                const percentage = rmToPercentage(legacyRmValue);
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
                    legacyRmValue,
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
                displayText: `${legacyRmValue}RM`,
                source: "relative-text",
            };
        }
    }

    // 5. 无任何强度配置
    return { source: "none" };
}
