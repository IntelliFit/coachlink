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
