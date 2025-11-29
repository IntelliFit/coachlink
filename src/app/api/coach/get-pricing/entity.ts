import type { CoachPricingRow } from "@/types";

export interface GetPricingDto {
    coach_id: string; // 教练ID
}

export interface GetPricingResponseDto {
    pricing: CoachPricingRow | null;
}