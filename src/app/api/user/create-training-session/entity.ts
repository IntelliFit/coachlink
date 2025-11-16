import { Database } from "@/types/database.types";

// 请求参数的接口类型
export type CreateTrainingSessionDto = Database['public']['Tables']['training_sessions']['Insert'];

// 返回参数的接口类型
export type CreateTrainingSessionResponseDto = Database['public']['Tables']['training_sessions']['Insert'];