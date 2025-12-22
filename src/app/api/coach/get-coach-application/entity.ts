import { CoachApplicationRow } from "@/types";

// 请求参数的接口类型
export interface GetCoachApplicationDto {
    // 根据ID获取特定申请
    id?: string;
    // 或者根据用户ID获取自己的申请
    userId?: string;
}

// 返回参数的接口类型
export interface GetCoachApplicationResponseDto {
    application: CoachApplicationRow | null;
}