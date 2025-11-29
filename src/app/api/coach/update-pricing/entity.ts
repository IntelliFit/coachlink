import type { CoachPricingRow } from "@/types";

export interface UpdatePricingDto {
    pricings: any;
}


export interface UpdatePricingResponseDto {
    pricing: CoachPricingRow;
}