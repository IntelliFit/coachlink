import supabase from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";
import { fillTemplate, matchPlan } from "./match";
import { sendDirectMessage } from "@/lib/chat";
import { randomInt } from "crypto";
import {
    generatePersonalizedPlan,
    buildTemplateSummary,
    buildPRRecordSummaries,
    buildActionLibrary,
} from "../ai-personalize-plan/service";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export interface CreateAiInstanceParams {
    actorUserId: string;
    actorCoachId: string;
    subscriptionId: string;
    startWeek?: number;
    startDay?: number;
    keepOriginalIndex?: boolean;
    delayedActivation?: boolean; // 是否延迟激活（2分钟后才显示给学员）
    useLLM?: boolean; // 是否使用 LLM 个性化生成（Feature Flag）
}

export async function createAiInstanceForSubscription(params: CreateAiInstanceParams) {
    const {
        actorUserId,
        actorCoachId,
        subscriptionId,
        startWeek,
        startDay,
        delayedActivation = false,
        useLLM = false,
    } = params;

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();

    if (subscriptionError) {
        throw new ApiError(subscriptionError.message, 500);
    }

    if (!subscription) {
        throw new ApiError("订阅关系不存在", 404);
    }

    if (subscription.coach_id !== actorCoachId) {
        throw new ApiError("无权限为该学员生成计划", 403);
    }

    if (subscription.status !== "active") {
        throw new ApiError("当前学员订阅非活跃状态，无法生成计划", 400);
    }

    const answers = subscription.subscribe_data as unknown as TrainingItem[];

    // 获取学员体重与姓名
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight, nickname, full_name, goal, training_age, height, body_fat")
        .eq("user_id", subscription.student_id)
        .single();

    const studentBodyWeight = profile?.weight || null;
    const studentNameRaw = (profile?.nickname || profile?.full_name || "学员").trim();
    const studentName = studentNameRaw || "学员";

    // --- QUOTA CHECK START ---
    const { checkAndConsumeAiQuota } = await import("@/lib/membershipLimit");
    const quotaResult = await checkAndConsumeAiQuota(subscription.student_id, 1);
    if (!quotaResult.success) {
        throw new ApiError(
            quotaResult.message || "AI 生成配额不足，请升级会员或购买加油包",
            403,
        );
    }
    // --- QUOTA CHECK END ---

    // 获取支持自动计算的动作列表（包含 includesBodyWeight）
    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, canonical_action_id, enableAutoWeightCompute, includesBodyWeight")
        .eq("enableAutoWeightCompute", true);

    let trainingDays: any[] = [];
    let selectedTemplateId: string | null = null;
    let aiGenerationLog: any = null;
    let planDescription = "暂无描述";
    let selectTemplate: any = null; // 保留引用，用于后续取 tags/type/suitable_for

    // ==================== 分支：LLM 个性化 vs 规则匹配 ====================
    if (useLLM) {
        // ---------- LLM 路径 ----------
        console.log("[create-ai-instance] 使用 LLM 个性化生成计划");

        // 1. 获取学员 PR 记录
        const { getCurrent1RMRecords } = await import("@/app/api/student/get-current-1rm/route");
        const prRecords = await getCurrent1RMRecords(actorCoachId, {
            targetUserId: subscription.student_id,
        });

        // 2. 获取教练动作库（白名单）
        const { data: coachActions } = await supabase
            .from("coach_actions")
            .select("id, name, category, type, description")
            .eq("coach_id", actorCoachId);

        // 3. 获取可用模板摘要
        const { data: allTemplates } = await supabase
            .from("coach_plan_templates")
            .select("id, name, description, type, metadata, training_days")
            .eq("coach_id", actorCoachId);

        const availableTemplates = (allTemplates || []).map(buildTemplateSummary);

        // 4. 调用 LLM 两阶段流水线
        try {
            const aiResult = await generatePersonalizedPlan({
                subscriptionId,
                actorUserId,
                actorCoachId,
                studentId: subscription.student_id,
                studentName,
                questionnaireAnswers: answers,
                studentBodyWeight,
                studentProfile: {
                    goal: profile?.goal,
                    trainingAge: profile?.training_age,
                    height: profile?.height,
                    weight: profile?.weight,
                    bodyFat: profile?.body_fat,
                },
                prRecords: buildPRRecordSummaries(prRecords),
                actionLibrary: buildActionLibrary(coachActions || []),
                availableTemplates,
            });

            trainingDays = aiResult.trainingDays;
            selectedTemplateId = aiResult.templateId;
            aiGenerationLog = aiResult.aiGenerationLog;
            planDescription = aiGenerationLog.stageB.reasoning;
        } catch (llmError: any) {
            console.error("[create-ai-instance] LLM 生成失败，fallback 到规则匹配:", llmError);
            // Fallback：继续走下面的规则匹配路径
        }
    }

    // ---------- 规则匹配路径（默认或 LLM fallback）----------
    if (!trainingDays || trainingDays.length === 0) {
        console.log("[create-ai-instance] 使用规则匹配生成计划");

        const templates = await matchPlan(answers, actorCoachId);

        if (!templates || templates.length === 0) {
            throw new ApiError("没有匹配的训练计划", 400);
        }

        // 多模板匹配时：随机选择一个模板
        selectTemplate = templates.length === 1
            ? templates[0]
            : templates[randomInt(0, templates.length)]

        selectedTemplateId = selectTemplate.id;

        // 根据用户数据进行填充，同时自动计算负重
        await fillTemplate(answers, selectTemplate, {
            studentBodyWeight,
            autoComputeActions: autoComputeActions || [],
            studentId: subscription.student_id,
            coachId: actorCoachId,
        });

        trainingDays = (selectTemplate.training_days as any[]) || [];
        planDescription = selectTemplate.description || "暂无描述";
    }

    // ==================== 起始位置与 Carryover 逻辑 ====================
    const normalizedStartWeek = Number(startWeek ?? 1);
    const normalizedStartDay = Number(startDay ?? 1);
    const hasExplicitStartPosition =
        (startWeek !== undefined || startDay !== undefined) &&
        ((Number.isFinite(normalizedStartWeek) && normalizedStartWeek > 1) ||
            (Number.isFinite(normalizedStartDay) && normalizedStartDay > 1));
    let startExecutionDay = ((normalizedStartWeek - 1) * 7) + normalizedStartDay;

    if (!hasExplicitStartPosition) {
        const carryover = await getSubscriptionCarryoverSummary({
            subscriptionId,
            subscribedWeeks: Number(subscription.subscribed_weeks || 0),
        });

        if (carryover.exhausted) {
            throw new ApiError("当前订阅剩余周期已耗尽，请续费后再创建新计划", 400);
        }
        startExecutionDay = 1;
    }

    if (startExecutionDay > trainingDays.length) {
        throw new ApiError(
            `起始位置超出模板总天数(${trainingDays.length}天)`,
            400,
        );
    }

    const hasCustomStartPosition = hasExplicitStartPosition && startExecutionDay > 1;
    const effectiveStartWeek = Math.floor((startExecutionDay - 1) / 7) + 1;
    const effectiveStartDay = ((startExecutionDay - 1) % 7) + 1;

    const planBaseName = `${studentName}的计划`;
    const planName = hasCustomStartPosition
        ? `${planBaseName}（从第${effectiveStartWeek}周${effectiveStartDay > 1 ? `第${effectiveStartDay}天` : ""}开始）`
        : planBaseName;

    const initialStatus = delayedActivation ? "scheduled" : "active";

    const insertPayload: any = {
        name: planName,
        description: hasCustomStartPosition
            ? `从第${effectiveStartWeek}周第${effectiveStartDay}天开始执行，前${startExecutionDay - 1}天视为已完成`
            : planDescription,
        coach_subscription_id: subscriptionId,
        coach_id: subscription.coach_id || null,
        student_id: subscription.student_id || null,
        coach_plan_template_id: selectedTemplateId,
        start_date: new Date().toISOString(),
        end_date: null,
        status: initialStatus,
        training_days: trainingDays,
        start_execution_day: startExecutionDay,
        source: useLLM ? "ai-personalized" : "coach",
        // 保留模板的元数据字段（来自规则匹配路径的模板）
        tags: selectTemplate?.tags ?? null,
        type: selectTemplate?.type ?? null,
        suitable_for: selectTemplate?.suitable_for ?? null,
    };

    // LLM 路径额外写入 AI 生成日志
    if (aiGenerationLog) {
        insertPayload.ai_generation_log = aiGenerationLog;
    }

    const { data: template, error: updateError } = await supabase
        .from("coach_plan_instances")
        .insert(insertPayload)
        .select("*")
        .single();

    if (updateError) {
        throw new ApiError(updateError.message, 500);
    }

    // ==================== 通知学员 ====================
    if (delayedActivation && template) {
        console.log(`[create-ai-instance] 计划 ${template.id} 已创建为 scheduled 状态，将在2分钟后由定时任务激活`);
    } else {
        try {
            const studentId = subscription.student_id as string | null;
            if (studentId) {
                const safePlanName = (planName || "训练计划").trim();
                const content =
                    `✅ 你的训练计划已制定完成：**${safePlanName}**\n\n` +
                    `请点击 [今日训练](/today-training) 查看并开始训练。`;

                await sendDirectMessage({
                    fromUserId: actorUserId,
                    toUserId: studentId,
                    content,
                    contentMetadata: {
                        kind: "plan_instance_created",
                        instance_id: template.id,
                        link: "/today-training",
                        ai_generated: true,
                    },
                });
            }
        } catch (e) {
            console.error("[create-ai-instance] Failed to notify student:", e);
        }
    }

    return template;
}
