import { TrainingPlanRow } from "@/types";

export interface GetTrainingPlansDto {
    limit?: number;
    offset?: number;
}

export interface GetTrainingPlansResponseDto {
    plans: TrainingPlanRow[];
    total: number;
    limit: number;
    offset: number;
}
