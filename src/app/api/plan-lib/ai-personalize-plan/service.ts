import supabase from "@/lib/supabaseClient";
import { fillTemplate } from "../create-ai-instance/match";
import { selectTemplateWithLLM } from "./select-template";
import { inferPlanPhaseWeeks, personalizePlanWithLLM } from "./personalize-plan";
import { validateAndSanitizeTrainingDays } from "./validate-output";
import {
    GeneratePersonalizedPlanInput,
    GeneratePersonalizedPlanOutput,
    ActionLibraryEntry,
    PRRecordSummary,
    TemplateSummary,
} from "./entity";
import { inferFocusDomainsFromTemplate } from "./questionnaire-intent";

export class AiPersonalizeError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function generatePersonalizedPlan(
    input: GeneratePersonalizedPlanInput,
): Promise<GeneratePersonalizedPlanOutput> {
    const { actorUserId, actorCoachId, studentId } = input;

    const stageA = await selectTemplateWithLLM(input);
    console.log("[ai-personalize-plan] Stage A result:", stageA);

    let selectedTemplate: any = null;
    if (stageA.templateId) {
        const { data: tpl } = await supabase
            .from("coach_plan_templates")
            .select("*")
            .eq("id", stageA.templateId)
            .eq("coach_id", actorUserId)
            .maybeSingle();

        if (tpl) {
            selectedTemplate = { ...tpl, __source: "template" };
        } else {
            const { data: inst } = await supabase
                .from("coach_plan_instances")
                .select("*")
                .eq("id", stageA.templateId)
                .eq("coach_id", actorCoachId)
                .maybeSingle();

            if (inst) {
                selectedTemplate = { ...inst, __source: "instance" };
                stageA.source = "instance";
            } else {
                stageA.reasoning = `${stageA.reasoning || "LLM 选择了一个骨架"}（候选 ${stageA.templateId} 已不存在或无权访问，改为自主生成）`;
                stageA.templateId = null;
                stageA.source = "none";
                stageA.confidence = Math.min(stageA.confidence || 0.5, 0.5);
            }
        }
    }

    if (!selectedTemplate && (!input.actionLibrary || input.actionLibrary.length === 0)) {
        throw new AiPersonalizeError("教练没有可用模板且动作库为空，AI 无法生成计划", 400);
    }

    if (selectedTemplate && (!input.actionLibrary || input.actionLibrary.length === 0)) {
        const templateDays = cloneTrainingDays(selectedTemplate.training_days);
        const aiGenerationLog = {
            stageA,
            stageB: {
                trainingDays: templateDays,
                reasoning: "教练动作库读取为空，系统保留已选模板骨架，避免模型编造动作或生成空计划。",
                changesSummary: "保留模板原始训练日",
            },
            promptVersion: "v1.3-script",
            model: "coachlink-llm",
            timestamp: new Date().toISOString(),
        };

        const tempTemplate = {
            ...selectedTemplate,
            training_days: templateDays,
        };

        await fillTemplate(input.questionnaireAnswers, tempTemplate, {
            studentBodyWeight: input.studentBodyWeight,
            autoComputeActions: [],
            studentId,
            coachId: actorUserId,
        });

        return {
            trainingDays: tempTemplate.training_days,
            templateId: stageA.templateId,
            aiGenerationLog,
        };
    }

    const stageB = await personalizePlanWithLLM({
        ...input,
        selectedTemplate,
    });
    console.log("[ai-personalize-plan] Stage B summary:", stageB.changesSummary);

    const { days: sanitizedDays, warnings } = validateAndSanitizeTrainingDays(
        stageB.trainingDays,
        input.actionLibrary,
    );

    if (warnings.length > 0) {
        console.warn("[ai-personalize-plan] validation warnings:", warnings);
    }

    let effectiveTrainingDays = sanitizedDays;
    let effectiveStageB = stageB;

    if (!hasAnyTrainingAction(sanitizedDays) && selectedTemplate && hasAnyTrainingAction(selectedTemplate.training_days)) {
        const templateDays = cloneTrainingDays(selectedTemplate.training_days);
        effectiveTrainingDays = templateDays;
        effectiveStageB = {
            ...stageB,
            trainingDays: templateDays,
            reasoning: `${stageB.reasoning || "AI 结果缺少有效动作"}；由于 AI 输出在校验后没有留下有效动作，系统已退回所选模板骨架。`,
            changesSummary: `${stageB.changesSummary || "AI 输出已校验"}；校验后回退到模板骨架`,
        };
    }

    if (!hasAnyTrainingAction(effectiveTrainingDays)) {
        throw new AiPersonalizeError("AI 生成结果没有有效训练动作，无法创建计划", 400);
    }

    const targetPlanWeeks = inferPlanPhaseWeeks({
        subscribedWeeks: input.subscribedWeeks,
        selectedTemplate,
        availableTemplates: input.availableTemplates,
    });
    const requireCompletePhase = !selectedTemplate && Number(input.subscribedWeeks || 0) > 0;

    effectiveTrainingDays = enforcePlanSpan(
        effectiveTrainingDays,
        targetPlanWeeks,
        !requireCompletePhase,
    );

    const tempTemplate = {
        ...(selectedTemplate || {}),
        training_days: effectiveTrainingDays,
    };

    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, canonical_action_id, enableAutoWeightCompute, includesBodyWeight")
        .eq("coach_id", actorUserId)
        .eq("enableAutoWeightCompute", true);

    await fillTemplate(input.questionnaireAnswers, tempTemplate, {
        studentBodyWeight: input.studentBodyWeight,
        autoComputeActions: autoComputeActions || [],
        studentId,
        coachId: actorUserId,
    });

    const aiGenerationLog = {
        stageA,
        stageB: effectiveStageB,
        promptVersion: "v1.3-script",
        model: "coachlink-llm",
        timestamp: new Date().toISOString(),
    };

    return {
        trainingDays: tempTemplate.training_days,
        templateId: stageA.templateId,
        aiGenerationLog,
    };
}

function cloneTrainingDays(trainingDays: any): any[] {
    if (!Array.isArray(trainingDays)) return [];
    return JSON.parse(JSON.stringify(trainingDays));
}

function hasAnyTrainingAction(trainingDays: any): boolean {
    if (!Array.isArray(trainingDays)) return false;

    return trainingDays.some((day) =>
        day?.type === "training" &&
        Array.isArray(day?.actionSets) &&
        day.actionSets.some((action: any) => typeof action?.actionId === "string" && action.actionId.trim().length > 0)
    );
}

export function buildTemplateSummary(tpl: any): TemplateSummary {
    const days = (tpl.training_days as any[]) || [];
    const focusDomains = inferFocusDomainsFromTemplate(tpl);
    const metadata = tpl.metadata && typeof tpl.metadata === "object" && !Array.isArray(tpl.metadata)
        ? { ...tpl.metadata }
        : {};

    if (focusDomains.length > 0) {
        metadata.aiFocusDomains = focusDomains;
    }

    return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        type: tpl.type,
        source: tpl.__source || tpl.source || "template",
        metadata,
        weekCount: Math.ceil(days.length / 7),
        dayCount: days.length,
    };
}

export function buildPRRecordSummaries(records: any[]): PRRecordSummary[] {
    return (records || []).map((r) => ({
        actionName: r.actionName || r.name || "未知动作",
        actionId: r.actionId,
        current1RM: r.current1RM ?? r.one_rm ?? 0,
        unit: r.unit || "kg",
    }));
}

export function buildActionLibrary(actions: any[]): ActionLibraryEntry[] {
    return (actions || []).map((a) => ({
        id: a.id,
        name: a.name || "未命名动作",
        type: a.type || undefined,
        category: a.category || a.type || undefined,
        description: a.description || a.detail || undefined,
    }));
}

function enforcePlanSpan(
    trainingDays: any[],
    targetPlanWeeks?: number | null,
    allowShorterThanTarget?: boolean,
): any[] {
    const targetWeeks = Number(targetPlanWeeks || 0);
    if (!Number.isFinite(targetWeeks) || targetWeeks <= 0) {
        return trainingDays;
    }

    const targetDays = targetWeeks * 7;
    if (!allowShorterThanTarget && trainingDays.length < targetDays) {
        throw new AiPersonalizeError(
            `AI 生成的计划周期过短：当前只有 ${trainingDays.length} 天，但本次单阶段计划目标是 ${targetWeeks} 周，至少应生成 ${targetDays} 天的完整计划。`,
            400,
        );
    }

    if (trainingDays.length <= targetDays) {
        return trainingDays;
    }

    const trimmed = trainingDays.slice(0, targetDays).map((day, index) => ({
        ...day,
        dayIndex: index + 1,
    }));

    console.warn(
        `[ai-personalize-plan] plan span trimmed from ${trainingDays.length} to ${targetDays} days` +
        (allowShorterThanTarget ? " with shorter-phase allowance" : ""),
    );

    return trimmed;
}
