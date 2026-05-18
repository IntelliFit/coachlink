export interface GetStudentPlanHistoryDto {
    studentId: string;
    page?: number;
    limit?: number;
    source?: "coach" | "student" | "all";
}

export interface StudentPlanHistoryItem {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    total_days?: number;
    total_training_days?: number;
    plan_span_days?: number;
    completed_days?: number;
    completion_rate?: number;
    archive_reason?: string | null;
    entitlement_consumption_policy?: string | null;
}

export interface GetStudentPlanHistoryResponseDto {
    plans: StudentPlanHistoryItem[];
    totalCount: number;
    page: number;
    limit: number;
    studentName?: string;
}
