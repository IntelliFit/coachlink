import type { CoachPricingRow } from "@/types";
import { Json } from "@/types/database.types";

export interface GetPricingDto {
    coachId?: string;
    userId?: string;
}

// 层级类型
export type PricingTier = "basic" | "standard" | "vip";
// 产品类型
export type ProductType = "single" | "combo";

// 时长选项
export interface DurationOption {
    months: number; // 月数
    price: number; // 价格
    is_recommend?: boolean; // 是否推荐
}

// 产品/套餐
export interface Product {
    id: string;
    tier: PricingTier; // 所属层级
    type: ProductType; // 单项目/组合
    name: string; // 产品名称
    description?: string;
    included_products?: string[]; // 如果是combo，包含的子项目
    duration_options: DurationOption[]; // 时长价格选项
}

// 向后兼容：旧版 Pricing 接口
export interface Pricing {
    title: string;
    price: number;
    features: string[];
    is_recommend: boolean;
    is_ai_plan: boolean;
    [key: string]: Json;
}

export interface GetPricingResponseDto {
    // 新版数据结构
    products?: Product[];
    // 向后兼容旧版
    pricings?: Pricing[];
}
