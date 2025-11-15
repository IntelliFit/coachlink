import { TrainingPlanRow } from "@/types";
import { Database } from "@/types/database.types";

export type GetTrainingPlansDto = {
    coachId?: string
}

export interface GetTrainingPlansResponseDto {
    plans: TrainingPlanRow[]
}