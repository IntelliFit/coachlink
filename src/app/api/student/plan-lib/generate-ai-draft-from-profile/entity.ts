import type { FormPlanTrainingDay } from "@/app/api/plan-lib/create-template/entity";

export interface GenerateAiDraftFromProfileDto {
    days?: number;
}

export interface GenerateAiDraftFromProfileResponseDto {
    name: string;
    description: string;
    trainingDays: FormPlanTrainingDay[];
}


