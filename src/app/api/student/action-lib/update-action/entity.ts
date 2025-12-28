import { StudentActionInsert, StudentActionRow } from "@/types/student";

export interface UpdateStudentActionDto extends StudentActionInsert {
    id: string;
}

export interface UpdateStudentActionResponseDto {
    action: StudentActionRow;
}
