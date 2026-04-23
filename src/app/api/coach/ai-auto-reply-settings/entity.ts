import type { CoachAiKnowledgeDocument } from "@/lib/coachAiKnowledge";

export interface CoachAiAutoReplySettingsDto {
    enabled: boolean;
    systemPrompt: string;
    knowledgeBase: string;
    knowledgeDocuments?: CoachAiKnowledgeDocument[];
}

export interface CoachAiAutoReplySettingsResponseDto extends CoachAiAutoReplySettingsDto {
    knowledgeDocuments: CoachAiKnowledgeDocument[];
    model: string;
    updatedAt: string | null;
}
