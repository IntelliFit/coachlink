import supabase from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";
import { fillTemplate } from "../create-ai-instance/match";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { selectTemplateWithLLM } from "./select-template";
import { personalizePlanWithLLM } from "./personalize-plan";
import { validateAndSanitizeTrainingDays } from "./validate-output";
import {
    GeneratePersonalizedPlanInput,
    GeneratePersonalizedPlanOutput,
    ActionLibraryEntry,
    PRRecordSummary,
    TemplateSummary,
} from "./entity";

export class AiPersonalizeError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/**
 * 主入口：为学员生成个性化训练计划
 *
 * 两阶段流水线：
 * 1. Stage A: LLM 选择最佳模板（或决定从零生成）
 * 2. Stage B: LLM 基于模板骨架调计划（或从零生成）
 * 3. 后处理: JSON 校验 + 动作库白名单过滤 + 自动计算重量
 */
export async function generatePersonalizedPlan(
    input: GeneratePersonalizedPlanInput,
): Promise<GeneratePersonalizedPlanOutput> {
    const { actorCoachId, studentId } = input;

    // ==================== Stage A: 选模板 ====================
    const stageA = await selectTemplateWithLLM(input);
    console.log("[ai-personalize-plan] Stage A 结果:", stageA);

    // 如果选中了模板，查询完整模板数据
    let selectedTemplate: any = null;
    if (stageA.templateId) {
        const { data: tpl } = await supabase
            .from("coach_plan_templates")
            .select("*")
            .eq("id", stageA.templateId)
            .single();

        if (tpl) {
            selectedTemplate = tpl;
        } else {
            console.warn(`[ai-personalize-plan] 选中的模板 ${stageA.templateId} 不存在，将从零生成`);
            stageA.templateId = null;
            stageA.reasoning += "（选中的模板已不存在，从零生成）";
        }
    }

    // ==================== Stage B: 调计划 ====================
    const stageB = await personalizePlanWithLLM({
        ...input,
        selectedTemplate,
    });
    console.log("[ai-personalize-plan] Stage B 结果:", stageB.changesSummary);

    // ==================== 后处理：校验 + 白名单过滤 ====================
    const { days: sanitizedDays, warnings } = validateAndSanitizeTrainingDays(
        stageB.trainingDays,
        input.actionLibrary,
    );

    if (warnings.length > 0) {
        console.warn("[ai-personalize-plan] 校验警告:", warnings);
    }

    // ==================== 后处理：自动计算重量 ====================
    // 复用现有的 fillTemplate 中的 computeActionWeight 逻辑
    // 这里我们构造一个 mock 的 template 结构，让 fillTemplate 帮我们算重量
    const tempTemplate = {
        ...selectedTemplate,
        training_days: sanitizedDays,
    };

    // 获取支持自动计算的动作列表
    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, canonical_action_id, enableAutoWeightCompute, includesBodyWeight")
        .eq("enableAutoWeightCompute", true);

    await fillTemplate(input.questionnaireAnswers, tempTemplate, {
        studentBodyWeight: input.studentBodyWeight,
        autoComputeActions: autoComputeActions || [],
        studentId,
        coachId: actorCoachId,
    });

    // fillTemplate 会修改 tempTemplate.training_days 中每个动作的 params.load
    const finalTrainingDays = tempTemplate.training_days;

    // ==================== 组装输出 ====================
    const aiGenerationLog = {
        stageA,
        stageB,
        promptVersion: "v1.0",
        model: "deepseek-chat/deepseek-reasoner",
        timestamp: new Date().toISOString(),
    };

    return {
        trainingDays: finalTrainingDays,
        templateId: stageA.templateId,
        aiGenerationLog,
    };
}

/**
 * 从 coach_plan_templates 行构建 TemplateSummary（给 LLM 看，节省 token）
 */
export function buildTemplateSummary(tpl: any): TemplateSummary {
    const days = (tpl.training_days as any[]) || [];
    return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        type: tpl.type,
        metadata: tpl.metadata,
        weekCount: Math.ceil(days.length / 7),
        dayCount: days.length,
    };
}

/**
 * 从 PR 记录构建简化版摘要
 */
export function buildPRRecordSummaries(records: any[]): PRRecordSummary[] {
    return (records || []).map((r) => ({
        actionName: r.actionName || r.name || "未知动作",
        actionId: r.actionId,
        current1RM: r.current1RM ?? r.one_rm ?? 0,
        unit: r.unit || "kg",
    }));
}

/**
 * 从 coach_actions 构建动作库白名单
 */
export function buildActionLibrary(actions: any[]): ActionLibraryEntry[] {
    return (actions || []).map((a) => ({
        id: a.id,
        name: a.name || "未命名动作",
        category: a.category || a.type || undefined,
        description: a.description || undefined,
    }));
}
