/**
 * 强度描述系统类型定义
 *
 * @description 支持多种强度描述方式：RM、百分比、固定重量
 * @date 2025-12-26
 */

/**
 * 相对强度类型
 * - rm: RM次数，如5RM（能做5次的最大重量）
 * - percentage: 百分比，如80%（1RM的80%）
 */
export type RelativeIntensityType = "rm" | "percentage";

/**
 * 相对强度配置
 * 需要学员的1RM数据才能计算具体重量
 */
export interface RelativeIntensity {
    type: RelativeIntensityType;
    /**
     * RM次数（1-30）或 百分比数值（1-100）
     */
    value: number;
}

/**
 * 重量单位
 */
export type WeightUnit = "kg" | "lbs";

/**
 * 推荐负重配置
 * 固定重量，不需要计算
 */
export interface RecommendedLoad {
    value: number;
    unit: WeightUnit;
}

/**
 * 固定重量配置
 * 直接写死到计划里，不再跟随 1RM 自动重算
 */
export interface FixedWeightLoad {
    value: number;
    unit: WeightUnit;
}

/**
 * 强度配置（完整结构）
 * 两个属性都是可选的，按优先级使用：
 * 1. 有 relativeIntensity + 有1RM → 计算具体重量
 * 2. 有 relativeIntensity + 无1RM → 显示相对强度文字 + 使用 recommendedLoad（如有）
 * 3. 有 fixedWeight → 直接按固定重量显示
 * 4. 只有 recommendedLoad → 作为备选推荐重量显示
 */
export interface IntensityConfig {
    /** 相对强度（优先使用） */
    relativeIntensity?: RelativeIntensity;
    /** 固定重量（不再跟随 1RM 自动重算） */
    fixedWeight?: FixedWeightLoad;
    /** 推荐数值（备选，当无法计算时使用） */
    recommendedLoad?: RecommendedLoad;
}

/**
 * 计算结果来源
 * - calculated: 根据1RM计算得出
 * - recommended: 使用推荐数值
 * - relative-text: 显示相对强度文字（无法计算）
 * - none: 无强度信息
 */
export type IntensitySource =
    | "calculated"
    | "recommended"
    | "relative-text"
    | "none";

/**
 * 计算结果类型
 */
export interface CalcIntensityResult {
    /** 显示的重量数值 */
    displayWeight?: number;
    /** 重量单位 */
    displayUnit?: WeightUnit;
    /** 备用文字显示（如"5RM"、"80%"） */
    displayText?: string;
    /** 结果来源 */
    source: IntensitySource;
}

/**
 * 强度计算选项
 */
export interface CalcIntensityOptions {
    /** 新格式：强度配置 */
    intensityConfig?: IntensityConfig;
    /** 旧格式兼容：RM值（对应原 params.强度） */
    legacyRm?: number;
    /** 学员该动作的 1RM（可能为空） */
    oneRM?: number;
    /** 学员体重 (kg) */
    bodyWeight: number;
    /** 动作是否包含体重（如引体向上、臂屈伸） */
    includesBodyWeight: boolean;
}

// ============ 工具函数类型 ============

/**
 * 单位转换常量
 */
export const WEIGHT_UNIT_CONVERSION = {
    KG_TO_LBS: 2.20462,
    LBS_TO_KG: 0.453592,
} as const;

/**
 * 将重量从 lbs 转换为 kg
 */
export function lbsToKg(lbs: number): number {
    return lbs * WEIGHT_UNIT_CONVERSION.LBS_TO_KG;
}

/**
 * 将重量从 kg 转换为 lbs
 */
export function kgToLbs(kg: number): number {
    return kg * WEIGHT_UNIT_CONVERSION.KG_TO_LBS;
}

/**
 * 标准化重量为 kg
 */
export function normalizeToKg(value: number, unit: WeightUnit): number {
    return unit === "lbs" ? lbsToKg(value) : value;
}

/**
 * 格式化重量显示
 */
export function formatWeight(value: number, unit: WeightUnit): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}${unit}`;
}
