// 请求参数的接口类型
export interface SubmitRecordDto {
    leaderboardType: 'pullup' | 'bench_press' | 'squat' | 'deadlift';
    weightKg: number;
    videoUrl: string;
    douyinNickname?: string;
    gender?: 'male' | 'female';
    notes?: string;
}

// 返回参数的接口类型
export interface SubmitRecordResponseDto {
    recordId: string;
    submittedAt: string;
}
