export interface SubmitQuestionnaireDto {
    questionnaireId: string;
    answers: Record<string, any>;
    context: "initial" | "cycle_end" | "manual_update" | "coach_request";
    planInstanceId?: string;
}

export interface SubmitQuestionnaireResponseDto {
    responseId: string;
    version: number;
}
