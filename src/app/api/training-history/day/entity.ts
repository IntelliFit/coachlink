export interface GetTrainingDayHistoryDto {
    date: string; // YYYY-MM-DD
}

export type TrainingSourceType = "IMPROMPTU" | "SELF_PLAN" | "COACH_PLAN";

export interface TrainingDayHistoryItem {
    id: string;
    sourceType: TrainingSourceType;
    status: string;
    startedAt: string;
    completedAt: string | null;
    totalSets: number;
    completedSets: number;
    title: string;
    actionSummaries?: Array<{
        actionName: string;
        completedSets: number;
        totalSets: number;
    }>;
}

export interface GetTrainingDayHistoryResponseDto {
    date: string;
    items: TrainingDayHistoryItem[];
}

