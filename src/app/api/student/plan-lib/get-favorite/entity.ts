import { StudentPlanFavoriteRow } from "@/types/student";

export interface GetFavoriteDto {
    id: string;
}

export interface GetFavoriteResponseDto {
    favorite: StudentPlanFavoriteRow;
}
