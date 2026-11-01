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
    /** 开始前起的名字；不填用默认名称 */
    title?: string | null;
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

