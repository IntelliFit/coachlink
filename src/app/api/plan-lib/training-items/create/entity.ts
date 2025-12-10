import { TrainingItemRow } from "@/types";

// 请求参数的接口类型
export interface CreateTrainingItemDto {
    name: string;
    description?: string | null;
}

// 返回参数的接口类型
export interface CreateTrainingItemResponseDto {
    trainingItem: TrainingItemRow;
}