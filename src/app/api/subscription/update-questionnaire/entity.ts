import type { TrainingItem } from "@/types/questionnaires";

export interface UpdateQuestionnairesDto {
    // subscription id
    id: string;
    // subscribe_data payload（仅提交本次问卷路径上的问题数组）
    questionnaires: TrainingItem[];
}

export interface UpdateQuestionnairesResponseDto {
    id: string;
}

