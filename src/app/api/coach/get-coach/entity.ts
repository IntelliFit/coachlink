import { CoachesRow } from "@/types";

export interface GetCoachDto {
    id: string;  // 教练ID
}

export interface GetCoachResponseDto {
    coach: CoachesRow | null;
}