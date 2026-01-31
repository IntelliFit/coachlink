import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { UpdateQuestionnairesDto, UpdateQuestionnairesResponseDto } from "./entity";

/**
 * 更新学员订阅问卷回答（coach_subscriptions.subscribe_data）
 *
 * 权限：
 * - 仅教练可更新
 * - 只能更新属于自己的订阅学员
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    if (!session.user.is_coach) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "仅教练可更新问卷", data: null },
            { status: 403 },
        );
    }

    const { id: subscriptionId, questionnaires } = (await req.json()) as UpdateQuestionnairesDto;

    if (!subscriptionId || !Array.isArray(questionnaires)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少必要参数", data: null },
            { status: 400 },
        );
    }

    // session.user.id 是 users.id；coach_subscriptions.coach_id 是 coaches.id
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "教练信息不存在", data: null },
            { status: 404 },
        );
    }

    const { data: subscription, error: subError } = await supabase
        .from("coach_subscriptions")
        .select("id, coach_id")
        .eq("id", subscriptionId)
        .single();

    if (subError || !subscription) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "订阅不存在", data: null },
            { status: 404 },
        );
    }

    if (subscription.coach_id !== coach.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "无权限修改此订阅", data: null },
            { status: 403 },
        );
    }

    const { data: updated, error: updateError } = await supabase
        .from("coach_subscriptions")
        .update({
            subscribe_data: questionnaires as any,
            updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select("id")
        .single();

    if (updateError || !updated) {
        console.error("[subscription/update-questionnaire] update failed:", updateError);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: updateError?.message || "更新失败", data: null },
            { status: 500 },
        );
    }

    const resp: UpdateQuestionnairesResponseDto = { id: updated.id };
    return NextResponse.json<ApiData<UpdateQuestionnairesResponseDto>>({
        success: true,
        message: "问卷更新成功",
        data: resp,
    });
}
