import { CoachActionRow } from "@/types";

export interface ListActionsDto {
    search?: string;
    page: number;
    limit: number;
}


export interface ListActionsResponseDto {
    actions: CoachActionRow[];
    totalCount: number;
    page: number;
    limit: number;
}