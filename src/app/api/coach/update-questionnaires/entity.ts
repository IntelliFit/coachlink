import { CoachLinkTable } from "@/types";
import { TrainingItem } from "@/types/questionnaires";

export interface UpdateQuestionnairesDto {
    id?: string;
    questionnaires: TrainingItem[];
    /** 保存模式：'online' = 线上版本, 'draft' = 灰度版本 */
    mode?: "online" | "draft";
}

export type CoachQuestionnairesInsert =
    CoachLinkTable["coach_questionnaires"]["Insert"];

export interface UpdateQuestionnairesResponseDto {
    id: string;
}
