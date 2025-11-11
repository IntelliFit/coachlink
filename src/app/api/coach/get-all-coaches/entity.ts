import { CoachesRow } from "@/types";

export interface GetAllCoachesDto {
    page?: number;      // 当前页码，默认 1
    limit?: number;     // 每页数量，默认 10
    search?: string;    // 搜索的名字（教练名字或者介绍）
    specialty?: string; // 专长
}

export interface GetAllCoachesResponseDto {
    coaches: CoachesRow[],
    count: number,
    pagination: {
        page: number,
        limit: number
    }
}