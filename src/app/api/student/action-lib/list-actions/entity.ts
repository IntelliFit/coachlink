import { StudentActionRow } from "@/types/student";

export interface ListStudentActionsDto {
    search?: string;
    page: number;
    limit: number;
}

export interface ListStudentActionsResponseDto {
    actions: StudentActionRow[];
    totalCount: number;
    page: number;
    limit: number;
}
