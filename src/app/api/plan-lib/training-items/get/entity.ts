import { TrainingItemRow } from "@/types";

// 请求参数的接口类型
export interface GetTrainingItemDto {
    id: string;
}

// 返回参数的接口类型
export interface GetTrainingItemResponseDto {
    trainingItem: TrainingItemRow | null;
}