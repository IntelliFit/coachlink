// API Entity Types for Extra Training Content

// Add Extra Set (在现有动作后添加额外组)
export interface AddExtraSetDto {
    executionId: string;
    actionIndex: number;
    weight?: number;
    reps?: number | string;
    restSeconds?: number;
}

export interface AddExtraSetResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        actionIndex: number;
        newSetIndex: number;
        totalSets: number;
    };
    message?: string;
}

// Add Extra Exercise (添加额外动作)
export interface AddExtraExerciseDto {
    executionId: string;
    actionId: string;        // student_actions 表中的动作ID
    actionName: string;
    sets: Array<{
        weight?: number;
        reps?: number | string;
        restSeconds?: number;
    }>;
}

export interface AddExtraExerciseResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        newActionIndex: number;
        actionName: string;
        setsCount: number;
    };
    message?: string;
}
