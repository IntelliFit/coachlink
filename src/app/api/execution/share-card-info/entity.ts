// 请求参数的接口类型
export interface ShareCardInfoDto {
    id: string;
}

// 返回参数的接口类型
export interface ShareCardInfoResponseDto {
    executionId: string;
    shareToken: string;
    dayIndex: number;
    planName: string;
    completedAt: string;
    totalVolume: number;
    totalSets: number;
    durationMinutes: number;
    prRecords: Array<{
        exerciseName: string;
        weight: number;
        reps: number;
    }>;
    monthlyTrainingDays: string[];
    user: {
        nickname: string;
        avatarUrl: string;
    };
}
