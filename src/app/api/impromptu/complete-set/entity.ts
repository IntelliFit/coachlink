export interface CompleteImpromptuSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
    actualWeight?: number | null;
    actualReps?: number | null;
    notes?: string;
}

export interface CompleteImpromptuSetResponseDto {
    executionId: string;
    completedSets: number;
    totalSets: number;
    status: string;
    action_executions: any[];
}

