import { CoachPlanInstanceRow } from "@/types";

// 请求参数的接口类型
export interface GetInstanceDto {
    id: string;
}

// 返回参数的接口类型
export interface GetInstanceResponseDto {
    instance: CoachPlanInstanceRow;
}