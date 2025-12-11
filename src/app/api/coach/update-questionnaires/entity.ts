import { CoachLinkTable } from "@/types";
import { TrainingItem } from "@/types/questionnaires";

export interface UpdateQuestionnairesDto {
    id?: string;
    questionnaires: TrainingItem[];
}

export type CoachQuestionnairesInsert = CoachLinkTable['coach_questionnaires']['Insert'];

export interface UpdateQuestionnairesResponseDto {
    id: string;
}