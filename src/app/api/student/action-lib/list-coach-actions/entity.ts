import { CoachActionRow } from "@/types/coach";

export interface ListCoachActionsResponseDto {
    actions: (CoachActionRow & { isAdded: boolean })[];
    totalCount: number;
    coachId: string | null;
    coachName: string | null;
}
