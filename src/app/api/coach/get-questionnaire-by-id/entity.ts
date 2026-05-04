import type { QuestionnaireEditorType, TrainingItem } from "@/types/questionnaires";

export interface GetQuestionnaireByIdDto {
    id: string;
}

export interface GetQuestionnaireByIdResponseDto {
    id: string;
    name?: string | null;
    status: "active" | "draft";
    questionnaires: TrainingItem[];
    editorType: QuestionnaireEditorType;
    version: number | null;
}
