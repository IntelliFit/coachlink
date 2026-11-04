import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";
import { fillTemplate, findClosestPlans, matchPlan } from "./match";
import { sendDirectMessage } from "@/lib/chat";
import { randomInt } from "crypto";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { archiveCurrentPlanInstancesForSubscription } from "@/lib/subscriptionEntitlement";
import { toBeijingDateKey } from "@/lib/beijingTime";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import {
    buildActionLibrary,
    buildPRRecordSummaries,
    buildTemplateSummary,
    generatePersonalizedPlan,
} from "../ai-personalize-plan/service";
import { AiPersonalizeError } from "../ai-personalize-plan/service";
import { buildProfileOneRmInputs, resolveProfileBodyWeight } from "@/lib/coachingAutomation/profileOneRm";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/** 生成期间（LLM 可能跑几分钟）这个订阅已经有了当前计划，例如教练手动建了一份。 */
export class PlanAlreadyExistsError extends ApiError {
    planInstanceId: string;
    constructor(planInstanceId: string) {
        super("该学员已有当前训练计划，已停止自动创建", 409);
        this.planInstanceId = planInstanceId;
    }
}

const CURRENT_PLAN_STATUSES = ["active", "paused", "draft", "scheduled"];

export interface CreateAiInstanceParams {
    actorUserId: string;
    actorCoachId: string;
    subscriptionId: string;
    startWeek?: number;
    startDay?: number;
    keepOriginalIndex?: boolean;
    delayedActivation?: boolean; // 是否延迟激活（2分钟后才显示给学员）
    initialStatus?: "active" | "draft" | "scheduled";
    useLLM?: boolean;
    /** 写入前再查一次：已有当前计划就抛 PlanAlreadyExistsError，而不是把它归档掉。 */
    skipIfCurrentPlanExists?: boolean;
}

function getLlmFailureMessage(error: unknown): string {
    if (error instanceof ApiError || error instanceof AiPersonalizeError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "AI 个性化生成失败";
}

export async function createAiInstanceForSubscription(params: CreateAiInstanceParams) {
    const {
        actorUserId,
        actorCoachId,
        subscriptionId,
        startWeek,
        startDay,
        delayedActivation = false,
        initialStatus: requestedInitialStatus,
        useLLM = false,
        skipIfCurrentPlanExists = false,
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

    // 教练没有问卷时订阅的 subscribe_data 是 [] 或 null，按空问卷生成。
    const answers = (Array.isArray(subscription.subscribe_data)
        ? subscription.subscribe_data
        : []) as unknown as TrainingItem[];

    // 获取学员体重与姓名
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight, nickname, full_name, fitness_goal, fitness_level, height, age, gender, lifestyle, sport_cards")
        .eq("user_id", subscription.student_id)
        .single();

    const studentBodyWeight = resolveProfileBodyWeight(profile);
    const studentNameRaw = (profile?.nickname || profile?.full_name || "学员").trim();
    const studentName = studentNameRaw || "学员";

    // 获取支持自动计算的动作列表（包含 includesBodyWeight）
    const { data: autoComputeActions } = await supabase
        .from("coach_actions")
        .select("id, name, canonical_action_id, enableAutoWeightCompute, includesBodyWeight")
        .eq("coach_id", actorUserId)
        .eq("enableAutoWeightCompute", true);

    // 档案运动数据卡里填过的主项 1RM（深蹲/卧推/硬拉/负重引体等），没有更新的记录时用来算重量
    const profileOneRmInputs = buildProfileOneRmInputs(profile?.sport_cards, autoComputeActions || []);

    let trainingDays: any[] = [];
    let selectedTemplateId: string | null = null;
    let selectedTemplateMeta: any = null;
    let aiGenerationLog: any = null;
    let planDescription = "暂无描述";
    let llmFallbackReason: string | null = null;

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
                profileOneRmInputs,
                studentProfile: {
                    goal: profile?.fitness_goal,
                    trainingAge: profile?.fitness_level,
                    height: profile?.height,
                    weight: studentBodyWeight,
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
            llmFallbackReason = getLlmFailureMessage(llmError);
            console.warn(`[create-ai-instance] LLM 生成失败，改用规则匹配兜底: ${llmFallbackReason}`);
        }
    }

    if (!trainingDays || trainingDays.length === 0) {
        console.log(
            llmFallbackReason
                ? "[create-ai-instance] LLM 失败后使用规则匹配生成计划"
                : "[create-ai-instance] 使用规则匹配生成计划",
        );

        const ruleMatch = await pickRuleMatchedTemplate(answers, actorUserId);

        if (!ruleMatch) {
            // 一并带上 AI 失败原因：这条错误会写进自动化任务并发给教练，否则看不出 AI 那一步为什么也没成。
            throw new ApiError(
                llmFallbackReason
                    ? `没有匹配的训练计划：AI 生成失败（${llmFallbackReason}），教练模板库里也没有带训练动作的模板`
                    : "没有匹配的训练计划：教练模板库里没有带训练动作的模板",
                400,
            );
        }

        const selectTemplate = ruleMatch.template;

        selectedTemplateId = selectTemplate.id;
        selectedTemplateMeta = selectTemplate;

        // 根据用户数据进行填充，同时自动计算负重
        await fillTemplate(answers, selectTemplate, {
            studentBodyWeight,
            autoComputeActions: autoComputeActions || [],
            studentId: subscription.student_id,
            coachId: actorUserId,
            profileOneRmInputs,
        });

        trainingDays = (selectTemplate.training_days as any[]) || [];
        planDescription = selectTemplate.description || "暂无描述";

        if (llmFallbackReason) {
            aiGenerationLog = {
                fallback: {
                    mode: ruleMatch.mode,
                    reason: llmFallbackReason,
                    templateId: selectTemplate.id,
                    createdAt: new Date().toISOString(),
                },
            };
        }
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

    // DB 约束 check_plan_status 不允许 pending，延迟展示使用 scheduled。
    // Automation can also create draft plans for coach review.
    const initialStatus = requestedInitialStatus ?? (delayedActivation ? "scheduled" : "active");

    if (skipIfCurrentPlanExists) {
        // 自动任务开头查过一次，但 LLM 可能跑了几分钟；2026-10-10 期间教练建的计划被这里的归档覆盖了。
        const { data: currentPlan, error: currentPlanError } = await supabase
            .from("coach_plan_instances")
            .select("id")
            .eq("coach_subscription_id", subscriptionId)
            .in("status", CURRENT_PLAN_STATUSES)
            .limit(1)
            .maybeSingle();
        if (currentPlanError) {
            throw new ApiError(`查询当前计划失败: ${currentPlanError.message}`, 500);
        }
        if (currentPlan?.id) {
            throw new PlanAlreadyExistsError(String(currentPlan.id));
        }
    }

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
            // Fresh plans do not acquire D1 at assignment time. Mid-cycle AI
            // plans may reuse an existing subscription's actual D1.
            start_date: startExecutionDay > 1 && subscription.start_date
                ? toBeijingDateKey(subscription.start_date)
                : null,
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
    if (initialStatus === "scheduled" && template) {
        console.log(`[create-ai-instance] 计划 ${template.id} 已创建为 scheduled 状态，将在2分钟后由定时任务激活`);
    } else if (initialStatus === "active") {
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

// 原始模板里的 one-filter 动作在 actions[] 里，填充前不能用 hasAnyTrainingAction 判断。
function templateHasActions(template: any): boolean {
    const days = Array.isArray(template?.training_days) ? template.training_days : [];
    return days.some((day: any) => (day?.actionSets || []).some((set: any) =>
        Boolean(set?.actionId || set?.action_id) || (Array.isArray(set?.actions) && set.actions.length > 0)
    ));
}

/**
 * 规则匹配：先按问卷标签 + 每周次数精确匹配，为空时取最接近的模板。
 * 精确匹配要求模板 week_days 含学员选的次数；2026-10-17 学员选 4 练、模板全是 2/3 练，于是整个任务失败。
 * 多个候选时随机选一个（“适合该学员的模板有多个就随机选一个”）。
 */
async function pickRuleMatchedTemplate(
    answers: TrainingItem[],
    coachUserId: string,
): Promise<{ template: any; mode: "rule_match" | "closest_match" } | null> {
    const pick = (templates: any[]) => templates[templates.length === 1 ? 0 : randomInt(0, templates.length)];

    const exact = ((await matchPlan(answers, coachUserId)) || []).filter(templateHasActions);
    if (exact.length > 0) return { template: pick(exact), mode: "rule_match" };

    const closest = ((await findClosestPlans(answers, coachUserId)) || []).filter(templateHasActions);
    if (closest.length > 0) return { template: pick(closest), mode: "closest_match" };

    return null;
}

function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
