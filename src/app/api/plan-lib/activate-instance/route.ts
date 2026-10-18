import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ActivateInstanceDto,
    ActivateInstanceResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { archiveCurrentPlanInstancesForSubscription } from "@/lib/subscriptionEntitlement";
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

    const { instanceId, archiveCurrentIfExists = true } = await req
        .json() as ActivateInstanceDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    const { data: targetInstance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, status, name, coach_subscription_id, source")
        .eq("id", instanceId)
        .single();

    if (fetchError || !targetInstance) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    const access = await resolvePlanInstanceAccess({ client: supabase, instance: targetInstance, userId });
    if (!access.isCoachOwner && !access.isSelfPlanOwner) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    let previousInstanceInfo: { id: string; newStatus: string } | undefined;
    const subscriptionId = (targetInstance as any).coach_subscription_id || null;

    // Only a subscription has a single current plan to replace; archiving by
    // student would also archive the plans of every coach the student has.
    if (archiveCurrentIfExists && subscriptionId) {
        const archiveResult = await archiveCurrentPlanInstancesForSubscription({
            supabase,
            subscriptionId,
            excludeInstanceId: instanceId,
        });
        const previousId = archiveResult.archivedIds[0];
        if (previousId) {
            previousInstanceInfo = {
                id: previousId,
                newStatus: "archived",
            };
        }
    }

    const { data: activated, error: activateError } = await supabase
        .from("coach_plan_instances")
        .update({
            status: "active",
            updated_at: new Date().toISOString(),
        })
        .eq("id", instanceId)
        .select()
        .single();

    if (activateError) {
        console.error("Error activating instance:", activateError);
        return NextResponse.json({
            success: false,
            message: `激活失败: ${activateError.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ActivateInstanceResponseDto>>({
        success: true,
        message: previousInstanceInfo
            ? `已归档旧计划并激活 "${targetInstance.name}"`
            : `已激活 "${targetInstance.name}"`,
        data: {
            success: true,
            newActiveInstance: activated,
            previousInstance: previousInstanceInfo,
        },
    });
}
