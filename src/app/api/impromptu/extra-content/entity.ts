export interface AddImpromptuExtraSetDto {
    executionId: string;
    actionIndex: number;
    weight?: number | null;
    reps?: number | null;
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
        weight?: number | null;
        reps?: number | null;
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

