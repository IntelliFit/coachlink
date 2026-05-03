import type { QuestionnaireEditorType } from "@/types/questionnaires";

export interface ListQuestionnairesDto {
    coachId?: string; // 可选：查看某教练（教练端一般不需要传）
}

export interface QuestionnaireTemplateItem {
    id: string;
    name: string;
    version: number | null;
    created_at: string | null;
    updated_at: string | null;
    is_default: boolean;
    status: "active" | "draft";
    editorType: QuestionnaireEditorType;
}

export interface ListQuestionnairesResponseDto {
    items: QuestionnaireTemplateItem[];
    defaultId: string | null;
}
