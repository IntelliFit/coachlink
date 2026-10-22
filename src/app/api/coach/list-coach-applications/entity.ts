import { CoachApplicationRow } from "@/types";

// 请求参数的接口类型
export interface ListCoachApplicationsDto {
    status?: string | string[];
    page?: number;
    limit?: number;
}

// 返回参数的接口类型
export interface ListCoachApplicationsResponseDto {
    applications: CoachApplicationRow[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}