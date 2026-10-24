export interface CompleteImpromptuSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
    actualWeight?: number | null;
    actualDuration?: number | null;
    weightUnit?: "kg" | "lbs" | null;
    weightInput?: number | null;
    actualReps?: number | null;
    notes?: string;
    rpe?: number | null;
    isPR?: boolean;
}

export interface CompleteImpromptuSetResponseDto {
    executionId: string;
    completedSets: number;
    totalSets: number;
    status: string;
    action_executions: any[];
    autoE1RM?: {
        e1rm: number;
        isPR: boolean;
        previousPR?: number;
    };
}

