export interface GetIntakeQuestionsDto {
    coach_id: string; // 教练ID
}

export interface GetIntakeQuestionsResponseDto {
    questions: string[]; // 问题列表
}