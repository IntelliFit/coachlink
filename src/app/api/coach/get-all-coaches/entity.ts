import { CoachesRow } from "@/types";

export interface GetAllCoachesDto {
    page?: number;      // 当前页码，默认 1
    limit?: number;     // 每页数量，默认 10
    search?: string;    // 搜索的名字（教练名字或者介绍）
    specialty?: string; // 专长
    coachTrack?: string; // 教练层级
    preferredCoachTrack?: string; // 用于默认推荐排序的优先层级
    serviceMode?: string; // 服务方式
    targetStudentLevel?: string; // 适合学员阶段
}

export interface GetAllCoachesResponseDto {
    coaches: CoachesRow[],
    count: number,
    pagination: {
        page: number,
        limit: number
    }
}
