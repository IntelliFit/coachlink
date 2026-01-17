import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { CreateInstanceDto, CreateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { sendDirectMessage } from "@/lib/chat";

export async function POST(req: Request) {
    const {
        name,
        description,
        templateId,
        subscriptionId,
        startDate,
        endDate,
        status,
        type,
        suitableFor,
        tags,
        trainingDays,
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

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("coach_id, student_id")
        .eq("id", subscriptionId)
        .single();

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message,
        }, { status: 500 });
    }

    // Calculate start_execution_day if backdated

    // 创建计划实例
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .insert({
            name,
            description: description || null,
            coach_subscription_id: subscriptionId,
            coach_id: subscription.coach_id || null,
            student_id: subscription.student_id || null,
            coach_plan_template_id: templateId || null,
            start_date: startDate || null,
            end_date: endDate || null,
            tags: tags || null,
            type: type || null,
            suitable_for: suitableFor || null,
            status: status || "active",
            training_days: trainingDays,
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

    // best-effort: notify student via chat message
    try {
        const studentId = subscription.student_id as string | null;
        if (studentId) {
            const planName = name?.trim() || "训练计划";
            const content =
                `✅ 你的训练计划已制定完成：**${planName}**\n\n` +
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

    // Backfill executions if backdated
    console.log("[create-instance] Checking backfill:", {
        startDate,
        isArray: Array.isArray(trainingDays),
        trainingDaysLength: Array.isArray(trainingDays)
            ? trainingDays.length
            : "N/A",
    });

    if (startDate && Array.isArray(trainingDays)) {
        const start = new Date(startDate);
        const now = new Date();
        start.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);

        if (start < now) {
            // Filter for training days only (not rest days)
            const trainingOnlyDays = (trainingDays as any[]).filter((d) =>
                d.type === "training" || !d.type
            );
            // Sort by dayIndex to ensure sequential order
            trainingOnlyDays.sort((a, b) =>
                (a.dayIndex || 0) - (b.dayIndex || 0)
            );

            console.log(
                "[create-instance] Training days to check:",
                trainingOnlyDays.length,
            );

            const pastExecutions = [];

            for (let i = 0; i < trainingOnlyDays.length; i++) {
                const day = trainingOnlyDays[i];
                // dayIndex IS the calendar day position (1 = first day of plan, 2 = second day, etc.)
                // So the offset is simply dayIndex - 1 (0-based days from start)
                const dayIndex = day.dayIndex || (i + 1);
                const offset = dayIndex - 1; // Calendar days from start date

                const dDate = new Date(start);
                dDate.setDate(dDate.getDate() + offset);

                // If day is in the past (before today), mark as completed
                if (dDate < now) {
                    pastExecutions.push({
                        instance_id: instance.id,
                        student_id: instance.student_id,
                        day_index: dayIndex,
                        status: "completed",
                        started_at: dDate.toISOString(),
                        completed_at: dDate.toISOString(),
                        action_executions: [],
                    });
                }
            }

            console.log(
                "[create-instance] Past executions to create:",
                pastExecutions.length,
            );

            if (pastExecutions.length > 0) {
                const { error: execError } = await supabase
                    .from("plan_instance_executions")
                    .insert(pastExecutions);

                if (execError) {
                    console.error("Failed to backfill executions:", execError);
                }
            }
        }
    }

    return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
        success: true,
        message: "创建训练计划实例成功",
        data: {
            instance,
        },
    });
}
