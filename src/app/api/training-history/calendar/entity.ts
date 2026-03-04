export interface GetTrainingCalendarDto {
    month: string; // YYYY-MM
}

export interface TrainingCalendarDayStat {
    date: string; // YYYY-MM-DD
    sessions: number;
}

export interface GetTrainingCalendarResponseDto {
    days: TrainingCalendarDayStat[];
}

