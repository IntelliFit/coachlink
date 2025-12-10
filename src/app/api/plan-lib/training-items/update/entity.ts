import { TrainingItemRow } from "@/types";

// 请求参数的接口类型
export interface UpdateTrainingItemDto {
    id: string;
    name?: string;
    description?: string | null;
}

// 返回参数的接口类型
export interface UpdateTrainingItemResponseDto {
    trainingItem: TrainingItemRow;
}