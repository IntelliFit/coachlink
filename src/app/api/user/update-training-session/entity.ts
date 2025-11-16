import { Database } from "@/types/database.types";

// 请求参数的接口类型
export type UpdateTrainingSessionDto = Database['public']['Tables']['training_sessions']['Update'];

// 返回参数的接口类型
export type UpdateTrainingSessionResponseDto = Database['public']['Tables']['training_sessions']['Update'];