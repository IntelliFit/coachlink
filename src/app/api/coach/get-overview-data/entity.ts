export interface GetOverviewDataDto {
}

export interface GetOverviewDataResponseDto {
    totalStudentCount: number;
    pendingReviewCount: number;
    averageRating: number;
    monthlyRevenue: number;
    recentActivity: string;
}