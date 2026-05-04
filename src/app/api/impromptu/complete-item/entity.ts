export interface CompleteImpromptuItemDto {
    executionId: string;
    actionIndex: number;
    itemType: "DIET" | "CARDIO" | "HABIT";
    completed: boolean;
    photoUrl?: string;
    actualContent?: string;
    actualDistance?: number;
    actualDuration?: number;
    notes?: string;
}

export interface CompleteImpromptuItemResponseDto {
    executionId: string;
    completedItems: number;
    totalItems: number;
    action_executions: any[];
}
