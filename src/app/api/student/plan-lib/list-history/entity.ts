export interface ListHistoryDto {
    page?: number;
    limit?: number;
    source?: "coach" | "student" | "all";
}

export interface PlanHistoryItem {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    // Computed fields
    completion_rate?: number;
    total_days?: number;
    completed_days?: number;
}

export interface ListHistoryResponseDto {
    plans: PlanHistoryItem[];
    totalCount: number;
    page: number;
    limit: number;
}
