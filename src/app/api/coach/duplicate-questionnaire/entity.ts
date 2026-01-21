export interface DuplicateQuestionnaireDto {
    id: string; // source questionnaire id
    name?: string; // optional new name
}

export interface DuplicateQuestionnaireResponseDto {
    id: string; // new questionnaire id
}

