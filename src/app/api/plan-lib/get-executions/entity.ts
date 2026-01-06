export interface GetExecutionsDto {
    instanceId: string;
}

export interface ExecutionRecord {
    id: string;
    plan_instance_id: string;
    day_index: number;
    execution_date: string;
    completed_at: string | null;
    notes: string | null;
    is_completed: boolean;
    created_at: string;
}

export interface GetExecutionsResponseDto {
    executions: ExecutionRecord[];
}
