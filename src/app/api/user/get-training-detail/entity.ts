import { TrainingDetailRow, TrainingPlanRow } from "@/types"


export interface GetTrainingPlansDetailDto {
    id: string;
}

export interface GetTrainingPlansDetailResponseDto {
    details: TrainingDetailRow[]
    plan: TrainingPlanRow;
}