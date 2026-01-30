import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    AddPublicActionToMyLibDto,
    AddPublicActionToMyLibResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        const { actionId, targetActionType = "student" } =
            (await req.json()) as AddPublicActionToMyLibDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: publicAction, error: fetchError } = await supabase
            .from("community_actions")
            .select("*")
            .eq("id", actionId)
            .single();

        if (fetchError || !publicAction) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        const targetTable =
            targetActionType === "coach" ? "coach_actions" : "student_actions";
        const ownerColumn = targetActionType === "coach" ? "coach_id" : "user_id";

        // 已添加（用同名约束判断）
        const { data: existing } = await supabase
            .from(targetTable)
            .select("id")
            .eq(ownerColumn, userId)
            .eq("name", (publicAction as any).name)
            .limit(1)
            .single();

        if (existing) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "您已有同名动作，无需重复添加", data: null },
                { status: 409 },
            );
        }

        const insertData: any = {
            [ownerColumn]: userId,
            name: (publicAction as any).name,
            detail: (publicAction as any).detail,
            positions: (publicAction as any).positions,
            attrs: (publicAction as any).attrs,
            url: (publicAction as any).url,
            type: (publicAction as any).type,
            item_schema: (publicAction as any).item_schema,
            suggested_time: (publicAction as any).suggested_time,
            enableAutoWeightCompute: (publicAction as any).enableAutoWeightCompute,
            includesBodyWeight: (publicAction as any).includesBodyWeight,
            canonical_action_id: (publicAction as any).canonical_action_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data: newAction, error: insertError } = await supabase
            .from(targetTable)
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            console.error("[public-action-lib] add-to-my-lib insert error:", insertError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "加入动作失败", data: null },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<AddPublicActionToMyLibResponseDto>>({
            success: true,
            message: "已成功添加到您的动作库",
            data: { action: newAction },
        });
    } catch (e) {
        console.error("[public-action-lib] add-to-my-lib unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

