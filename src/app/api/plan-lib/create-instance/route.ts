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

    // Calculate start_execution_day if provided (migration mid-cycle)
    const normalizedStartWeek = Number(startWeek ?? 1);
    const normalizedStartDay = Number(startDay ?? 1);
    const hasStartPosition = Number.isFinite(normalizedStartWeek) &&
        Number.isFinite(normalizedStartDay) &&
        normalizedStartWeek >= 1 &&
        normalizedStartDay >= 1 &&
        normalizedStartDay <= 7;

    const startExecutionDay = hasStartPosition
        ? (normalizedStartWeek - 1) * 7 + normalizedStartDay
        : 1;

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

    // Ensure a subscription has at most one "current" plan instance.
    // When creating a new instance for the same subscription, archive any previous active/paused instances.
    try {
        const nowIso = new Date().toISOString();
        await supabase
            .from("coach_plan_instances")
            .update({
                status: "archived",
                updated_at: nowIso,
            } as any)
            .eq("coach_subscription_id", subscriptionId)
            .in("status", ["active", "paused"]);
    } catch (e) {
        // best-effort; do not block instance creation
        console.warn(
            "[create-instance] Failed to archive previous instances:",
            e,
        );
    }

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
