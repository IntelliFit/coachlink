// 获取训练进度统计请求和响应的类型定义

export interface GetProgressStatsDto {
    training_plan_id: string;
}

export interface GetProgressStatsResponseDto {
    totalSessions: number;
    completedSessions: number;
    skippedSessions: number;
    currentStreak: number;
    totalExercises: number;
    completedExercises: number;
    totalVolume: number;
    avgRPE: number;
    progressPercentage: number;
    lastTrainingDate?: string;
}

