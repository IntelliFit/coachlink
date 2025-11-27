import { CoachLinkTable } from "@/types";

export interface UpdateQuestionnairesDto {
    id?: string;
    questionnaires: string[];
}

export type CoachQuestionnairesInsert = CoachLinkTable['coach_questionnaires']['Insert'];

export interface UpdateQuestionnairesResponseDto {
    id: string;
}