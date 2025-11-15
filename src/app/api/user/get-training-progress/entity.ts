// 获取训练进度请求和响应的类型定义

export interface GetTrainingProgressDto {
    training_plan_id?: string;
}

export interface ProgressStats {
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

export interface GetTrainingProgressResponseDto {
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