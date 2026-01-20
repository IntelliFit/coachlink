// 请求参数的接口类型
export interface CompleteItemDto {
    executionId: string;
    actionIndex: number;
    itemType: "DIET" | "CARDIO" | "HABIT";
    completed: boolean;
    // DIET specific
    photoUrl?: string;
    actualContent?: string;
    // CARDIO specific
    actualDistance?: number;
    actualDuration?: number;
    // Common
    notes?: string;
}

// 返回参数的接口类型
export interface CompleteItemResponseDto {
    executionId: string;
    completedItems: number;
    totalItems: number;
}
