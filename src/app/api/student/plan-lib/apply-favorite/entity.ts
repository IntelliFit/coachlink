import { StudentPlanFavoriteRow } from "@/types/student";

export interface ApplyFavoriteDto {
    favoriteId: string;
    startDate?: string; // 可选的开始日期，默认为今天
}

export interface ApplyFavoriteResponseDto {
    planInstanceId: string;
    message: string;
}
