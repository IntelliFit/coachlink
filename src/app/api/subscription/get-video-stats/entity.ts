export interface GetVideoStatsDto {
}

export interface GetVideoStatsResponseDto {
    total: number;
    pending: number;
    reviewed: number;
    not_required: number;
    averageRating: number;
}

