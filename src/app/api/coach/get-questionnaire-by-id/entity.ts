import type { TrainingItem } from "@/types/questionnaires";

export interface GetQuestionnaireByIdDto {
    id: string;
}

export interface GetQuestionnaireByIdResponseDto {
    id: string;
    questionnaires: TrainingItem[];
    is_active: boolean;
    version: number | null;
}

