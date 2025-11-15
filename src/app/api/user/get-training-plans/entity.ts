import { TrainingPlanRow } from "@/types";
import { Database } from "@/types/database.types";

export type GetTrainingPlansDto = {
    coachId?: string
    id?: string
}

export interface GetTrainingPlansResponseDto {
    plans: TrainingPlanRow[]
}