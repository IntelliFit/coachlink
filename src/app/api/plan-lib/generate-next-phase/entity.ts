export interface GenerateNextPhaseDto {
    completedPlanId: string;
    useUpdatedProfile?: boolean; // 是否使用最新的档案数据
    customInstructions?: string; // 用户自定义要求
}

export interface GenerateNextPhaseResponseDto {
    planInstanceId: string;
    planName: string;
    preview: {
        totalDays: number;
        trainingDays: number;
        restDays: number;
        focusAreas: string[];
    };
}
