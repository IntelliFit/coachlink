export interface AddImpromptuExtraSetDto {
    executionId: string;
    actionIndex: number;
    weight?: number | string | null;
    weightUnit?: "kg" | "lbs" | null; // unit `weight` was typed in; weight itself stays kg
    weightInput?: number | null;
    reps?: number | string | null;
    restSeconds?: number | null;
}

export interface AddImpromptuExtraSetResponseDto {
    executionId: string;
    actionIndex: number;
    newSetIndex: number;
    totalSets: number;
}

export interface AddImpromptuExtraExerciseDto {
    executionId: string;
    actionId: string;
    actionName: string;
    sets?: Array<{
        weight?: number | string | null;
        reps?: number | string | null;
        restSeconds?: number | null;
    }>;
}

export interface AddImpromptuExtraExerciseResponseDto {
    executionId: string;
    newActionIndex: number;
    actionName: string;
    setsCount: number;
    totalSets: number;
}

export interface DeleteImpromptuExtraSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
}

export interface DeleteImpromptuExtraSetResponseDto {
    executionId: string;
    actionIndex: number;
    totalSets: number;
}

export interface DeleteImpromptuExtraExerciseDto {
    executionId: string;
    actionIndex: number;
}

export interface DeleteImpromptuExtraExerciseResponseDto {
    executionId: string;
    totalSets: number;
}

