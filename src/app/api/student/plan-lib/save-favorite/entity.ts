import {
    StudentPlanFavoriteInsert,
    StudentPlanFavoriteRow,
} from "@/types/student";

export type SaveFavoriteDto = StudentPlanFavoriteInsert;

export interface SaveFavoriteResponseDto {
    favorite: StudentPlanFavoriteRow;
}
