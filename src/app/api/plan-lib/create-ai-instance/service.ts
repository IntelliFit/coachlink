import supabase from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";
import { fillTemplate, matchPlan } from "./match";
import { sendDirectMessage } from "@/lib/chat";
import { randomInt } from "crypto";

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
}

export async function createAiInstanceForSubscription(params: CreateAiInstanceParams) {
    const {
        actorUserId,
        actorCoachId,
        subscriptionId,
        startWeek = 1,
        startDay = 1,
        delayedActivation = false,
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
        .select("weight, nickname, full_name")
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

    const templates = await matchPlan(answers, actorCoachId);

    if (!templates || templates.length === 0) {
        throw new ApiError("没有匹配的训练计划", 400);
    }

    // 多模板匹配时：随机选择一个模板（满足“适合该学员的模板有多个就随机选一个”）
    const selectTemplate = templates.length === 1
        ? templates[0]
        : templates[randomInt(0, templates.length)];

    // 根据用户数据进行填充，同时自动计算负重
    await fillTemplate(answers, selectTemplate, {
        studentBodyWeight,
        autoComputeActions: autoComputeActions || [],
        studentId: subscription.student_id,
        coachId: actorCoachId,
    });

    // 起始执行位置逻辑：以周为单位保留完整结构
    const startExecutionDay = (startWeek - 1) * 7 + startDay;
    const trainingDays = (selectTemplate.training_days as any[]) || [];

    if (startExecutionDay > trainingDays.length) {
        throw new ApiError(
            `起始位置(第${startWeek}周第${startDay}天)超出模板总天数(${trainingDays.length}天)`,
            400,
        );
    }

    const planBaseName = `${studentName}的计划`;
    const planName = startExecutionDay > 1
        ? `${planBaseName}（从第${startWeek}周${startDay > 1 ? `第${startDay}天` : ""}开始）`
        : planBaseName;

    // DB 约束 check_plan_status 不允许 pending，延迟展示使用 scheduled
    const initialStatus = delayedActivation ? "scheduled" : "active";

    const { data: template, error: updateError } = await supabase
        .from("coach_plan_instances")
        .insert({
            name: planName,
            description: startExecutionDay > 1
                ? `从第${startWeek}周第${startDay}天开始执行，前${startExecutionDay - 1}天视为已完成`
                : "暂无描述",
            coach_subscription_id: subscriptionId,
            coach_id: subscription.coach_id || null,
            student_id: subscription.student_id || null,
            coach_plan_template_id: selectTemplate.id,
            start_date: new Date().toISOString(),
            end_date: null,
            tags: selectTemplate.tags,
            type: selectTemplate.type,
            suitable_for: selectTemplate.suitable_for,
            status: initialStatus,
            training_days: trainingDays,
            start_execution_day: startExecutionDay,
        })
        .select("*")
        .single();

    if (updateError) {
        throw new ApiError(updateError.message, 500);
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
