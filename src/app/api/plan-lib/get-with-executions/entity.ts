export interface GetWithExecutionsDto {
    subscriptionId?: string;
    instanceId?: string; // 支持直接通过 instanceId 查询（自建计划使用）
}

export interface GetWithExecutionsResponseDto {
    instance: any;
    training_days: any[];
    executions: Record<number, any>; // keyed by dayIndex
    actions: Record<string, any>;
}
