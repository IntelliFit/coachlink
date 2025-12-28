import { StudentActionRow } from "@/types/student";

export interface BatchCreateStudentActionItem {
    name: string;
    attrs?: string[];
}

export interface BatchCreateStudentActionsDto {
    actions: BatchCreateStudentActionItem[];
}

export interface BatchCreateStudentActionsResponseDto {
    createdActions: StudentActionRow[];
}
