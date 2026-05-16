// 请求参数的接口类型
export interface GetStudentStatsDto {}

// 返回参数的接口类型
export interface GetStudentStatsResponseDto {
    subscriptionCount: number; // 订阅的教练数量
    activePlanCount: number; // 进行中的训练计划数量
    completedWorkouts: number; // 已完成训练计划的数量
}
