import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";
import { fillTemplate, matchPlan } from "./match";
import { sendDirectMessage } from "@/lib/chat";
import { randomInt } from "crypto";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { archiveCurrentPlanInstancesForSubscription } from "@/lib/subscriptionEntitlement";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import {
    buildActionLibrary,
    buildPRRecordSummaries,
    buildTemplateSummary,
    generatePersonalizedPlan,
} from "../ai-personalize-plan/service";
import { AiPersonalizeError } from "../ai-personalize-plan/service";

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
    useLLM?: boolean;
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
        .select("weight, nickname, full_name, fitness_goal, fitness_level, height, age, gender, lifestyle, sport_cards")
        .eq("user_id", subscription.student_id)
        .single();

    const studentBodyWeight = profile?.weight || null;
    const studentNameRaw = (profile?.nickname || profile?.full_name || "学员").trim();
    const studentName = studentNameRaw || "学员";

    // 获取支持自动计算的动作列表（包含 includesBodyWeight）
    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, canonical_action_id, enableAutoWeightCompute, includesBodyWeight")
        .eq("coach_id", actorUserId)
        .eq("enableAutoWeightCompute", true);

    let trainingDays: any[] = [];
    let selectedTemplateId: string | null = null;
    let selectedTemplateMeta: any = null;
    let aiGenerationLog: any = null;
    let planDescription = "暂无描述";

    if (useLLM) {
        try {
            console.log("[create-ai-instance] 使用 LLM 个性化生成计划");

            const { getCurrent1RMRecords } = await import("@/app/api/student/get-current-1rm/route");
            const prRecords = await getCurrent1RMRecords(actorUserId, {
                targetUserId: subscription.student_id,
            });

            const { data: coachActions } = await supabase
                .from("coach_actions")
                .select("id, name, type, detail")
                .eq("coach_id", actorUserId);

            const { data: allTemplates } = await supabase
                .from("coach_plan_templates")
                .select("id, name, description, execution_notice, type, suitable_for, tags, metadata, training_days")
                .eq("coach_id", actorUserId);

            // 随机抽取 N 个历史学员计划作为参考，让 AI 能从教练过往交付中学习
            const HISTORY_SAMPLE_SIZE = 10;
            const { data: recentPlanInstances } = await supabase
                .from("coach_plan_instances")
                .select("id, name, description, execution_notice, type, suitable_for, tags, training_days, created_at")
                .eq("coach_id", actorCoachId)
                .neq("coach_subscription_id", subscriptionId)
                .limit(50);

            const sampledInstances = shuffleArray(recentPlanInstances || [])
                .slice(0, HISTORY_SAMPLE_SIZE);

            const availableTemplates = [
                ...(allTemplates || []).map((tpl) => buildTemplateSummary({ ...tpl, __source: "template" })),
                ...(sampledInstances || []).map((inst) => buildTemplateSummary({ ...inst, __source: "instance" })),
            ]
                .filter((template) => template.dayCount > 0);

            const aiResult = await generatePersonalizedPlan({
                subscriptionId,
                actorUserId,
                actorCoachId,
                studentId: subscription.student_id,
                studentName,
                subscribedWeeks: Number(subscription.subscribed_weeks || 0) || null,
                questionnaireAnswers: answers,
                studentBodyWeight,
                studentProfile: {
                    goal: profile?.fitness_goal,
                    trainingAge: profile?.fitness_level,
                    height: profile?.height,
                    weight: profile?.weight,
                    age: profile?.age,
                    gender: profile?.gender,
                    lifestyle: profile?.lifestyle,
                    sportCards: profile?.sport_cards,
                },
                prRecords: buildPRRecordSummaries(prRecords),
                actionLibrary: buildActionLibrary(coachActions || []),
                availableTemplates,
            });

            trainingDays = aiResult.trainingDays;
            selectedTemplateId = aiResult.templateId;
            selectedTemplateMeta = selectedTemplateId
                ? (allTemplates || []).find((tpl: any) => tpl.id === selectedTemplateId)
                    || (sampledInstances || []).find((inst: any) => inst.id === selectedTemplateId)
                    || null
                : null;
            aiGenerationLog = aiResult.aiGenerationLog;
            planDescription = aiGenerationLog?.stageB?.reasoning || "AI 个性化生成计划";

            if (!hasAnyTrainingAction(trainingDays)) {
                throw new ApiError("AI 生成结果没有有效训练动作，请调整模板或学员信息后重试", 400);
            }
        } catch (llmError) {
            console.error("[create-ai-instance] LLM 生成失败:", llmError);
            if (llmError instanceof ApiError) {
                throw llmError;
            }
            if (llmError instanceof AiPersonalizeError) {
                throw new ApiError(llmError.message, llmError.status);
            }
            const message = llmError instanceof Error ? llmError.message : "AI 个性化生成失败";
            throw new ApiError(message, 500);
        }
    } else if (!trainingDays || trainingDays.length === 0) {
        console.log("[create-ai-instance] 使用规则匹配生成计划");

        const templates = await matchPlan(answers, actorUserId);

        if (!templates || templates.length === 0) {
            throw new ApiError("没有匹配的训练计划", 400);
        }

        // 多模板匹配时：随机选择一个模板（满足“适合该学员的模板有多个就随机选一个”）
        const selectTemplate = templates.length === 1
            ? templates[0]
            : templates[randomInt(0, templates.length)];

        selectedTemplateId = selectTemplate.id;
        selectedTemplateMeta = selectTemplate;

        // 根据用户数据进行填充，同时自动计算负重
        await fillTemplate(answers, selectTemplate, {
            studentBodyWeight,
            autoComputeActions: autoComputeActions || [],
            studentId: subscription.student_id,
            coachId: actorUserId,
        });

        trainingDays = (selectTemplate.training_days as any[]) || [];
        planDescription = selectTemplate.description || "暂无描述";
    }

    if (!hasAnyTrainingAction(trainingDays)) {
        throw new ApiError("生成后的计划没有训练动作，已阻止创建空训练计划", 400);
    }

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
            subscriptionStartDate: (subscription as any)?.start_date || null,
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

    // DB 约束 check_plan_status 不允许 pending，延迟展示使用 scheduled
    const initialStatus = delayedActivation ? "scheduled" : "active";

    if (initialStatus === "active") {
        await archiveCurrentPlanInstancesForSubscription({
            supabase,
            subscriptionId,
        });
    }

    const { data: template, error: updateError } = await supabase
        .from("coach_plan_instances")
        .insert({
            name: planName,
            description: hasCustomStartPosition
                ? `从第${effectiveStartWeek}周第${effectiveStartDay}天开始执行，前${startExecutionDay - 1}天视为已完成`
                : planDescription,
            execution_notice: selectedTemplateMeta?.execution_notice || null,
            coach_subscription_id: subscriptionId,
            coach_id: subscription.coach_id || null,
            student_id: subscription.student_id || null,
            coach_plan_template_id: aiGenerationLog?.stageA?.source === "template" ? selectedTemplateId : null,
            start_date: new Date().toISOString(),
            end_date: null,
            tags: selectedTemplateMeta?.tags || null,
            type: selectedTemplateMeta?.type || null,
            suitable_for: selectedTemplateMeta?.suitable_for || null,
            status: initialStatus,
            training_days: trainingDays,
            start_execution_day: startExecutionDay,
            ...(aiGenerationLog ? { ai_generation_log: aiGenerationLog } : {}),
        } as any)
        .select("*")
        .single();

    if (updateError) {
        throw new ApiError(updateError.message, 500);
    }

    // 同步教练计划中的动作到学员动作库，保持手动从模板创建和 AI 创建的一致体验
    try {
        const studentId = subscription.student_id as string | null;
        if (studentId && Array.isArray(trainingDays)) {
            const actionIds = collectTrainingActionIds(trainingDays);

            if (actionIds.size > 0) {
                const idsList = Array.from(actionIds);
                const { data: coachActions } = await serviceRoleSupabase
                    .from("coach_actions")
                    .select("*")
                    .eq("coach_id", actorUserId)
                    .in("id", idsList);

                if (coachActions && coachActions.length > 0) {
                    await syncCoachActionsToStudentLibrary(
                        studentId,
                        coachActions as any[],
                        actionIds,
                    );
                }
            }
        }
    } catch (e) {
        console.warn("[create-ai-instance] Failed to sync actions to student library:", e);
    }

    // 如果延迟激活，计划已创建为 scheduled 状态
    // 激活任务由定时任务 /api/plan-lib/activate-pending-plans 处理（每1分钟检查一次）
    // 这样即使进程被回收，也能可靠地激活计划
    if (delayedActivation && template) {
        console.log(`[create-ai-instance] 计划 ${template.id} 已创建为 scheduled 状态，将在2分钟后由定时任务激活`);
    } else {
        // 立即激活时，立即通知学员
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

function collectTrainingActionIds(trainingDays: any[]): Set<string> {
    const actionIds = new Set<string>();

    for (const day of trainingDays || []) {
        for (const actionSet of day?.actionSets || []) {
            const actionId = actionSet?.action_id || actionSet?.actionId;
            if (typeof actionId === "string" && actionId.trim()) {
                actionIds.add(actionId.trim());
            }
        }
    }

    return actionIds;
}

function hasAnyTrainingAction(trainingDays: any[]): boolean {
    return collectTrainingActionIds(trainingDays).size > 0;
}

function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
