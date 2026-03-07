export interface GetTrainingMonthShareDto {
    month: string; // YYYY-MM
}

export interface GetTrainingMonthShareResponseDto {
    month: string;
    totalSessions: number;
    trainingDays: number;
    totalSets: number;
    sourceBreakdown: {
        impromptu: number;
        selfPlan: number;
        coachPlan: number;
    };
}

