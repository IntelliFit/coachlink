import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ArchiveInstanceDto, ArchiveInstanceResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { buildArchiveEntitlementPatch } from "@/lib/subscriptionEntitlement";
import { resolvePlanInstanceAccess } from "@/lib/planInstanceAccess";

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const {
        instanceId,
        archiveReason,
        entitlementPolicy,
        entitlementNote,
    } = await req.json() as ArchiveInstanceDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    const { data: instance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, status, coach_subscription_id, source")
        .eq("id", instanceId)
        .single();

    if (fetchError || !instance) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    // A student cannot archive the coach plan they train on, and only the coach
    // may decide how an archived plan is charged.
    const access = await resolvePlanInstanceAccess({ client: supabase, instance, userId });
    if (!access.isCoachOwner && !access.isSelfPlanOwner) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    const { count: completedExecutionCount } = await supabase
        .from("plan_instance_executions")
        .select("id", { count: "exact", head: true })
        .eq("instance_id", instanceId)
        .eq("status", "completed");

    const { data: updated, error: updateError } = await supabase
        .from("coach_plan_instances")
        .update({
            status: "archived",
            ...buildArchiveEntitlementPatch({
                hasCompletedExecution: Number(completedExecutionCount || 0) > 0,
                archiveReason: access.isCoachOwner ? archiveReason : undefined,
                entitlementPolicy: access.isCoachOwner ? entitlementPolicy : undefined,
                entitlementNote: access.isCoachOwner ? entitlementNote : undefined,
            }),
            updated_at: new Date().toISOString(),
        })
        .eq("id", instanceId)
        .select()
        .single();

    if (updateError) {
        console.error("Error archiving instance:", updateError);
        return NextResponse.json({
            success: false,
            message: `归档失败: ${updateError.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ArchiveInstanceResponseDto>>({
        success: true,
        message: "计划已归档",
        data: {
            success: true,
            instance: updated,
        },
    });
}
