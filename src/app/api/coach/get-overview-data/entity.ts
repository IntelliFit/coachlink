export interface GetOverviewDataDto {
}

export interface GetOverviewDataResponseDto {
    totalStudentCount: number;
    pendingReviewCount: number;
    averageRating: number;
    monthlyRevenue: number;
    contentCount: number;
    actionCount: number;
    planTemplateCount: number;
    questionReady: boolean;
    pricingReady: boolean;
    receivingAccountReady: boolean;
    huifuOpenStatus: string | null;
    huifuOpenMsg: string | null;
}
