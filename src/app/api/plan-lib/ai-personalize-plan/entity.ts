import { CoachPlanTemplateRow } from "@/types";
import { TrainingItem } from "@/types/questionnaires";
import { CoachPlanTrainingImplementationDay } from "../create-template/entity";

/**
 * 模板摘要（传给 LLM Stage A 选模板时使用，节省 token）
 */
export interface TemplateSummary {
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    metadata?: Record<string, any> | null;
    /** 总周数 */
    weekCount: number;
    /** 总训练天数 */
    dayCount: number;
}

/**
 * Stage A: LLM 选模板的结果
 */
export interface TemplateSelectionResult {
    templateId: string | null;
    reasoning: string;
    confidence: number;
}

/**
 * Stage B: LLM 调计划的结果
 */
export interface PersonalizePlanResult {
    trainingDays: CoachPlanTrainingImplementationDay[];
    reasoning: string;
    changesSummary: string;
}

/**
 * 单条 PR 记录（简化版，用于构建 prompt）
 */
export interface PRRecordSummary {
    actionName: string;
    actionId?: string;
    current1RM: number;
    unit: string;
}

/**
 * 教练动作库条目（简化版，用于构建 prompt）
 */
export interface ActionLibraryEntry {
    id: string;
    name: string;
    category?: string;
    description?: string;
}

/**
 * AI 生成日志（存入 plan_instance.ai_generation_log）
 */
export interface AiGenerationLog {
    stageA: TemplateSelectionResult;
    stageB: PersonalizePlanResult;
    promptVersion: string;
    model: string;
    timestamp: string;
}

/**
 * 生成个性化计划的输入参数
 */
export interface GeneratePersonalizedPlanInput {
    subscriptionId: string;
    actorUserId: string;
    actorCoachId: string;
    studentId: string;
    studentName: string;
    questionnaireAnswers: TrainingItem[];
    /** 学员体重（kg） */
    studentBodyWeight: number | null;
    /** 学员档案 */
    studentProfile: {
        goal?: string;
        trainingAge?: string;
        height?: number;
        weight?: number;
        bodyFat?: number;
        [key: string]: any;
    } | null;
    /** 最新 PR 记录 */
    prRecords: PRRecordSummary[];
    /** 教练动作库（白名单） */
    actionLibrary: ActionLibraryEntry[];
    /** 可用模板列表 */
    availableTemplates: TemplateSummary[];
    /** 若 Stage A 选中了模板，传入完整模板 */
    selectedTemplate?: CoachPlanTemplateRow | null;
}

/**
 * 生成个性化计划的输出
 */
export interface GeneratePersonalizedPlanOutput {
    /** 生成的训练日 */
    trainingDays: CoachPlanTrainingImplementationDay[];
    /** 选中的模板 ID（可能为 null，表示从零生成） */
    templateId: string | null;
    /** AI 决策日志 */
    aiGenerationLog: AiGenerationLog;
}
