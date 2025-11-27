import { CoachesRow } from "@/types";

export interface GetCoachDto {
    id?: string;
    userId?: string;
}

export interface GetCoachResponseDto {
    coach: CoachesRow | null;
}