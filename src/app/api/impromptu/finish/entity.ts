export interface FinishImpromptuDto {
    executionId: string;
    sessionNotes?: string;
    mode?: "quick";
}

export interface FinishImpromptuResponseDto {
    id: string;
    status: string;
    completed_at: string;
    completed_sets: number;
    total_sets: number;
}

