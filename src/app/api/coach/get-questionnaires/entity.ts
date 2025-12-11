import { TrainingItem } from "@/types/questionnaires";

export interface GetQuestionnairesDto {
    coachId?: string;
}

export interface GetQuestionnairesResponseDto {
    id: string;
    questionnaires: TrainingItem[];
}