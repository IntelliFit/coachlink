import { StudentActionInsert, StudentActionRow } from "@/types/student";

export type AddStudentActionDto = StudentActionInsert;

export interface AddStudentActionResponseDto {
    action: StudentActionRow;
}
