export interface UpdateIntakeQuestionsDto {
    coach_id: string;     // 教练ID
    questions: string[];  // 问题列表
}

export interface UpdateIntakeQuestionsResponseDto {
    success: boolean;
}