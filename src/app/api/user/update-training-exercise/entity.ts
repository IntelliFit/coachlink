// 璇锋眰鍙傛暟鐨勬帴鍙ｇ被鍨?
export interface UpdateTrainingExerciseDto {
    training_session_id: string;
    exercise_name: string;
    sets_completed?: number;
    reps_completed?: string;
    load_actual?: number;
    notes?: string;
}

// 杩斿洖鍙傛暟鐨勬帴鍙ｇ被鍨?
export interface UpdateTrainingExerciseResponseDto {
    training_session_id?: string;
    exercise_name?: string;
    sets_completed?: number;
    reps_completed?: string;
    load_actual?: number;
    notes?: string;
}
