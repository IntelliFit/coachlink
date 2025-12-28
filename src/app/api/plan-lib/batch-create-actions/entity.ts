import { CoachActionRow } from "@/types";

// 批量创建动作请求
export interface BatchCreateActionsDto {
    actions: {
        name: string;
        needsAutoCompute: boolean;
        includesBodyWeight: boolean;
    }[];
}

// 批量创建动作响应
export interface BatchCreateActionsResponseDto {
    createdActions: CoachActionRow[];
}
