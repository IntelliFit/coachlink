// 请求参数的接口类型
export interface CreatePRDto {
    executionId: string;
    actionId: string;
    actionName: string;
    setNumber: number;
    weight: number;
    reps: number;
    rpe?: number;
    notes?: string;
    videoId?: string;
}

// 返回参数的接口类型
export interface CreatePRResponseDto {
    id: string;
    user_id: string;
    exercise_name: string;
    weight: number; // Training weight
    reps: number; // Training reps
    e1rm: number; // Calculated e1RM
    load_formula: string;
    date_achieved: string;
}
