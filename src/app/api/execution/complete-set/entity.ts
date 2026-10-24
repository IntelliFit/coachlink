// 请求参数的接口类型
export interface CompleteSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
    actionId: string; // For video lookup
    actualWeight?: number | null;
    actualReps?: number | null;
    actualDuration?: number | null; // seconds for timed strength sets
    weightUnit?: "kg" | "lbs" | null; // unit the student typed; actualWeight stays in kg
    weightInput?: number | null; // number typed in weightUnit (server recomputes kg from it for lbs)
    rpe?: number;
    notes?: string;
    is_pr?: boolean; // PR flag
    has_video?: boolean; // Video uploaded flag
}

// 返回参数的接口类型
export interface CompleteSetResponseDto {
    executionId: string;
    completedSets: number;
    totalSets: number;
    // Auto e1RM calculation result (for PR celebration)
    autoE1RM?: {
        e1rm: number;
        isPR: boolean;
        previousPR?: number;
    };
}
