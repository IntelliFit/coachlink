import { CoachesRow } from "@/types";

export interface GetAggregatedInfoDto {
    coachId: string;
}

export interface GetAggregatedInfoResponseDto {
    coach: CoachesRow;
    contentCount: number;
    studentCount: number;
    reviewCount: number;
    averageRating: number;
}