import { StudentActionRow } from "@/types/student";

export interface CopyCoachActionDto {
    coachActionId: string;
}

export interface CopyCoachActionResponseDto {
    action: StudentActionRow;
}
