import { CoachActionRow } from "@/types";
import { ItemType } from "@/types/student";

export interface ListActionsDto {
    search?: string;
    type?: ItemType; // 可选：按类型筛选
    page: number;
    limit: number;
}

export interface ListActionsResponseDto {
    actions: CoachActionRow[];
    totalCount: number;
    page: number;
    limit: number;
}
