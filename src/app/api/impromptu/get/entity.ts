export interface GetImpromptuExecutionDto {
    id: string;
}

export interface GetImpromptuExecutionResponseDto {
    id: string;
    student_id: string;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    session_notes?: string | null;
    title?: string | null;
    started_at: string;
    completed_at?: string | null;
}

