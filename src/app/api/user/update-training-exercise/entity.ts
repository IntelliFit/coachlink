import { Database } from "@/types/database.types";

// 请求参数的接口类型
export interface UpdateTrainingExerciseDto {
    training_session_id: string;
    exercise_name: string;
    sets_completed?: number;
    reps_completed?: string;
    load_actual?: number;
    notes?: string;
}

// 返回参数的接口类型
export type UpdateTrainingExerciseResponseDto = Database['public']['Tables']['training_exercises']['Update'];