import type { Coach } from "@/types/coach";

export interface GetAllCoachesDto {
    page?: number;   // 当前页码，默认 1
    limit?: number;  // 每页数量，默认 10
}

export interface GetAllCoachesResponseDto {
    coaches: Coach[],
    count: number,
    pagination: {
        page: number,
        limit: number
    }
}