import type { CoachPricingRow } from "@/types";
import { Product } from "../get-pricing/entity";

export interface UpdatePricingDto {
    // 新版数据结构
    products?: Product[];
    // 向后兼容旧版
    pricings?: any;
}

export interface UpdatePricingResponseDto {
    pricing: CoachPricingRow;
}
