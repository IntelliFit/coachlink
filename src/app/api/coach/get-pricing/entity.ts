import type { CoachPricingRow } from "@/types";
import { Json } from "@/types/database.types";

export interface GetPricingDto {
    coach_id?: string;
}

export interface Pricing {
    title: string;
    price: number;         
    features: string[];    
    is_recommend: boolean;
    [key: string]: Json;
}


export interface GetPricingResponseDto {
    pricings: Pricing[]
}