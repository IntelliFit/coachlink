export interface GetQuestionnaireHistoryDto {
    studentId?: string; // 教练查看学员历史时提供
    questionnaireId?: string; // 可选，筛选特定问卷
    limit?: number;
}

export interface QuestionnaireResponse {
    id: string;
    answers: Record<string, any>;
    context: string;
    questionnaire_version: number;
    questionnaire_id: string | null;
    plan_instance_id: string | null;
    created_at: string;
}

export interface GetQuestionnaireHistoryResponseDto {
    responses: QuestionnaireResponse[];
    totalCount: number;
}
