import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { CreateInstanceDto, CreateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { sendDirectMessage } from "@/lib/chat";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import { validateTrainingDaysPresence } from "@/utils/template";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { archiveCurrentPlanInstancesForSubscription } from "@/lib/subscriptionEntitlement";

export async function POST(req: Request) {
    const {
        name,
        description,
        executionNotice,
        templateId,
        subscriptionId,
        startDate,
        endDate,
        status,
        type,
        suitableFor,
        tags,
        trainingDays,
        startWeek,
        startDay,
    } = await req.json() as CreateInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!name || !trainingDays) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    const trainingDaysPresence = validateTrainingDaysPresence(trainingDays);
    if (!trainingDaysPresence.valid) {
        return NextResponse.json({
            success: false,
            message: trainingDaysPresence.message,
        }, { status: 400 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("coach_id, student_id, subscribed_weeks, start_date")
        .eq("id", subscriptionId)
        .single();

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message,
        }, { status: 500 });
    }

    const { data: subscriptionCoach } = await serviceRoleSupabase
        .from("coaches")
        .select("user_id")
        .eq("id", subscription.coach_id)
        .maybeSingle();
    if (!subscriptionCoach || subscriptionCoach.user_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "无权为该订阅创建计划",
        }, { status: 403 });
    }

    let normalizedExecutionNotice = executionNotice?.trim() || null;
    if (executionNotice === undefined && templateId) {
        const { data: template } = await supabase
            .from("coach_plan_templates")
            .select("execution_notice")
            .eq("id", templateId)
            .eq("coach_id", userId)
            .maybeSingle();
        normalizedExecutionNotice = (template as any)?.execution_notice || null;
    }

    // Calculate start_execution_day if provided (migration mid-cycle)
    const normalizedStartWeek = Number(startWeek ?? 1);
    const normalizedStartDay = Number(startDay ?? 1);
    const hasExplicitStartPosition =
        (startWeek !== undefined || startDay !== undefined) &&
        ((Number.isFinite(normalizedStartWeek) && normalizedStartWeek > 1) ||
            (Number.isFinite(normalizedStartDay) && normalizedStartDay > 1));
    const hasStartPosition = Number.isFinite(normalizedStartWeek) &&
        Number.isFinite(normalizedStartDay) &&
        normalizedStartWeek >= 1 &&
        normalizedStartDay >= 1 &&
        normalizedStartDay <= 7;

    let startExecutionDay = hasStartPosition
        ? (normalizedStartWeek - 1) * 7 + normalizedStartDay
        : 1;

    if (!hasExplicitStartPosition && Array.isArray(trainingDays)) {
        const carryover = await getSubscriptionCarryoverSummary({
            subscriptionId,
            subscribedWeeks: Number((subscription as any)?.subscribed_weeks || 0),
            subscriptionStartDate: (subscription as any)?.start_date || null,
        });

        if (carryover.exhausted) {
            return NextResponse.json({
                success: false,
                message: "当前订阅剩余周期已耗尽，请续费后再创建新计划",
            }, { status: 400 });
        }

        startExecutionDay = 1;
    }

    if (hasStartPosition && Array.isArray(trainingDays)) {
        const totalDays = (trainingDays as any[]).length;
        if (startExecutionDay > totalDays) {
            return NextResponse.json({
                success: false,
                message:
                    `起始位置(第${normalizedStartWeek}周第${normalizedStartDay}天)超出计划总天数(${totalDays}天)`,
            }, { status: 400 });
        }
    }

    // 创建计划实例
    const { data: instance, error } = await serviceRoleSupabase
        .from("coach_plan_instances")
        .insert({
            name,
            description: description || null,
            execution_notice: normalizedExecutionNotice,
            coach_subscription_id: subscriptionId,
            coach_id: subscription.coach_id || null,
            student_id: subscription.student_id || null,
            coach_plan_template_id: templateId || null,
            // Auto-fill start_date when creating as active and no explicit date provided
            start_date: startDate ||
                ((!status || status === "active")
                    ? new Date().toISOString().split("T")[0]
                    : null),
            end_date: endDate || null,
            tags: tags || null,
            type: type || null,
            suitable_for: suitableFor || null,
            status: status || "active",
            training_days: trainingDays,
            start_execution_day: startExecutionDay > 1 ? startExecutionDay : 1,
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to create instance",
        }, { status: 500 });
    }

    // Publish the new row first, then archive every older current row. If the
    // archive step fails, remove only the newly-created row so the learner is
    // never left without the previous current plan.
    const shouldReplaceCurrent = !status || status === "active" || status === "paused";
    if (shouldReplaceCurrent) {
        try {
            await archiveCurrentPlanInstancesForSubscription({
                supabase: serviceRoleSupabase,
                subscriptionId,
                excludeInstanceId: instance.id,
            });
        } catch (archiveError: any) {
            const { error: rollbackError } = await serviceRoleSupabase
                .from("coach_plan_instances")
                .delete()
                .eq("id", instance.id);
            console.error("[create-instance] Failed to archive previous instances:", {
                archiveError,
                rollbackError,
            });
            return NextResponse.json({
                success: false,
                message: rollbackError
                    ? "新版本创建失败，且自动回滚失败，请联系管理员"
                    : "新版本创建失败，旧计划已保留",
            }, { status: 500 });
        }
    }

    // 同步教练计划中的动作到学员动作库
    try {
        const studentId = subscription.student_id as string | null;
        if (studentId && Array.isArray(trainingDays)) {
            // 提取计划中使用的所有动作ID
            const actionIds = new Set<string>();
            trainingDays.forEach((day: any) => {
                day.actionSets?.forEach((set: any) => {
                    const actionId = set.action_id || set.actionId;
                    if (actionId) {
                        actionIds.add(actionId);
                    }
                });
            });

            if (actionIds.size > 0) {
                // 查询教练动作库
                const idsList = Array.from(actionIds);
                const { data: coachActions } = await supabase
                    .from("coach_actions")
                    .select("*")
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
        // best-effort; do not block instance creation
        console.warn("[create-instance] Failed to sync actions to student library:", e);
    }

    // best-effort: notify student via chat message
    try {
        const studentId = subscription.student_id as string | null;
        if (studentId) {
            const planName = name?.trim() || "训练计划";
            const content = `✅ 你的训练计划已制定完成：**${planName}**\n\n` +
                `请点击 [今日训练](/today-training) 查看并开始训练。`;

            await sendDirectMessage({
                fromUserId: userId,
                toUserId: studentId,
                content,
                contentMetadata: {
                    kind: "plan_instance_created",
                    instance_id: instance.id,
                    link: "/today-training",
                },
            });
        }
    } catch (e) {
        console.error("[create-instance] Failed to notify student:", e);
    }

    return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
        success: true,
        message: "创建训练计划实例成功",
        data: {
            instance,
        },
    });
}
