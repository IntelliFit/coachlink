// 请求参数的接口类型
export interface GetNextTrainingDayDto {
    instanceId: string;
}

// 返回参数的接口类型
export interface GetNextTrainingDayResponseDto {
    nextDayIndex: number;
    completedDays: number[];
    totalTrainingDays: number;
    startExecutionDay?: number;
    todayCompleted: boolean; // 今天是否已有完成的训练
    todayExecutionId?: string; // 今天完成的执行记录ID（如果有）
    completionDates: Record<number, string>; // 每个训练日的完成日期 { dayIndex: ISO日期字符串 }
}