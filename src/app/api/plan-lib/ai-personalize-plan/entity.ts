import { CoachPlanTemplateRow } from "@/types";
import { TrainingItem } from "@/types/questionnaires";
import { CoachPlanTrainingImplementationDay } from "../create-template/entity";

export interface TemplateSummary {
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    source?: "template" | "instance";
    metadata?: Record<string, any> | null;
    weekCount: number;
    dayCount: number;
}

export interface TemplateSelectionResult {
    templateId: string | null;
    source?: "template" | "instance" | "none";
    reasoning: string;
    confidence: number;
}

export interface PersonalizePlanResult {
    trainingDays: CoachPlanTrainingImplementationDay[];
    planScript?: string;
    reasoning: string;
    changesSummary: string;
}

export interface PRRecordSummary {
    actionName: string;
    actionId?: string;
    current1RM: number;
    unit: string;
}

export interface ActionLibraryEntry {
    id: string;
    name: string;
    type?: string;
    category?: string;
    description?: string;
}

export interface AiGenerationLog {
    stageA: TemplateSelectionResult;
    stageB: PersonalizePlanResult;
    promptVersion: string;
    model: string;
    timestamp: string;
}

export interface GeneratePersonalizedPlanInput {
    subscriptionId: string;
    actorUserId: string;
    actorCoachId: string;
    studentId: string;
    studentName: string;
    subscribedWeeks?: number | null;
    questionnaireAnswers: TrainingItem[];
    studentBodyWeight: number | null;
    studentProfile: {
        goal?: string | null;
        trainingAge?: string | null;
        height?: number | null;
        weight?: number | null;
        bodyFat?: number | null;
        [key: string]: any;
    } | null;
    prRecords: PRRecordSummary[];
    actionLibrary: ActionLibraryEntry[];
    availableTemplates: TemplateSummary[];
    selectedTemplate?: CoachPlanTemplateRow | null;
}

export interface GeneratePersonalizedPlanOutput {
    trainingDays: CoachPlanTrainingImplementationDay[];
    templateId: string | null;
    aiGenerationLog: AiGenerationLog;
}
