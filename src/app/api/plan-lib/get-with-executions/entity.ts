export interface GetWithExecutionsDto {
    subscriptionId?: string;
}

export interface GetWithExecutionsResponseDto {
    instance: any;
    training_days: any[];
    executions: Record<number, any>; // keyed by dayIndex
    actions: Record<string, any>;
}