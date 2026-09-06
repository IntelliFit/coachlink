export interface ImpromptuActionInput {
    actionId?: string | null;
    actionName: string;
    itemType?: "STRENGTH" | "CARDIO";
    attrs?: string[] | null;
    category?: string | null;
    itemSchema?: Record<string, unknown> | null;
    suggestedTime?: string | null;
    sets: number;
    reps?: number | string | null;
    weight?: number | string | null;
    restSeconds?: number | null;
}

export interface StartImpromptuDto {
    actions: ImpromptuActionInput[];
}

export interface StartImpromptuResponseDto {
    id: string;
    student_id: string;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    started_at: string;
}

