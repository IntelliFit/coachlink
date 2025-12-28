import {
    StudentPlanFavoriteInsert,
    StudentPlanFavoriteRow,
} from "@/types/student";

export interface UpdateFavoriteDto extends StudentPlanFavoriteInsert {
    id: string;
}

export interface UpdateFavoriteResponseDto {
    favorite: StudentPlanFavoriteRow;
}
