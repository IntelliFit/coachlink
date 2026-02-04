import { CoachActionRow, ItemType } from "@/types";

// 批量创建动作请求
export interface BatchCreateActionsDto {
    actions: {
        name: string;
        needsAutoCompute: boolean;
        includesBodyWeight: boolean;
        attrs?: string[];
        positions?: string[];
        detail?: string;
        url?: string;
        type?: ItemType;
    }[];
}

// 批量创建动作响应
export interface BatchCreateActionsResponseDto {
    createdActions: CoachActionRow[];
}
