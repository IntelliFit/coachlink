import { CoachesRow } from "@/types";

export interface GetCoachDto {
    id?: string;
    userId?: string;
    needQrCode?: boolean;
}

export interface GetCoachResponseDto {
    coach: CoachesRow | null;
}