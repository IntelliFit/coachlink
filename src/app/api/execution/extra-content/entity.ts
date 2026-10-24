// API Entity Types for Extra Training Content

// Add Extra Set (在现有动作后添加额外组)
export interface AddExtraSetDto {
    executionId: string;
    actionIndex: number;
    weight?: number | string | null;
    weightUnit?: "kg" | "lbs" | null; // unit `weight` was typed in; weight itself stays kg
    weightInput?: number | null;
    reps?: number | string | null;
    restSeconds?: number | null;
}

export interface AddExtraSetResponseDto {
    executionId: string;
    actionIndex: number;
    newSetIndex: number;
    totalSets: number;
}

// Add Extra Exercise (添加额外动作)
export interface AddExtraExerciseDto {
    executionId: string;
    actionId: string;        // student_actions 表中的动作ID
    actionName: string;
    customData?: Record<string, any>;
    suggestedTime?: string;
    notes?: string;
    sets: Array<{
        weight?: number | string | null;
        reps?: number | string | null;
        restSeconds?: number | null;
    }>;
}

export interface AddExtraExerciseResponseDto {
    executionId: string;
    newActionIndex: number;
    actionName: string;
    setsCount: number;
}

// Delete Extra Set (删除学员自行添加的组)
export interface DeleteExtraSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
}

export interface DeleteExtraSetResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        actionIndex: number;
        totalSets: number;
    };
    message?: string;
}

// Delete Extra Exercise (删除学员自行添加的动作)
export interface DeleteExtraExerciseDto {
    executionId: string;
    actionIndex: number;
}

export interface DeleteExtraExerciseResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        totalSets: number;
    };
    message?: string;
}
