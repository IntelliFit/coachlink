export type CurrentImpromptuExecutionResponseDto = {
    id: string;
    student_id: string;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    started_at: string;
};
