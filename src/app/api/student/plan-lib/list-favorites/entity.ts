import { StudentPlanFavoriteRow } from "@/types/student";

export interface ListFavoritesDto {
    page: number;
    limit: number;
}

export interface ListFavoritesResponseDto {
    favorites: StudentPlanFavoriteRow[];
    totalCount: number;
    page: number;
    limit: number;
}
