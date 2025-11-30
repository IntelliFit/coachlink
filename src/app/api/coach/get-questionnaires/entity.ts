export interface GetQuestionnairesDto {
    coachId?: string;
}

export interface GetQuestionnairesResponseDto {
    id: string;
    questionnaires: string[];
}