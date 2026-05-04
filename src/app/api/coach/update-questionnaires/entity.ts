import { CoachLinkTable } from "@/types";
import { QuestionnaireEditorType, TrainingItem } from "@/types/questionnaires";

export interface UpdateQuestionnairesDto {
    id?: string;
    name?: string;
    editorType?: QuestionnaireEditorType;
    questionnaires: TrainingItem[];
}

export type CoachQuestionnairesInsert =
    CoachLinkTable["coach_questionnaires"]["Insert"];

export interface UpdateQuestionnairesResponseDto {
    id: string;
}
