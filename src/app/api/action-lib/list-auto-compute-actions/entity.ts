import { CoachActionRow } from "@/types";

export interface ListAutoComputeActionsDto {
    coachId: string
}


export interface ListAutoComputeActionsResponseDto {
    actions: CoachActionRow[];
}