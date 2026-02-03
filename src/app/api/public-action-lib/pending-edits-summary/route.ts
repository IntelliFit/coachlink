import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    PendingEditsSummaryResponseDto,
} from "./entity";

export async function POST() {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        const { data: ownedActions, error: actionsError } = await supabase
            .from("community_actions")
            .select("id, name")
            .eq("owner_user_id", userId);

        if (actionsError) {
            console.error("[public-action-lib] pending-edits-summary actions error:", actionsError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取公共动作失败", data: null },
                { status: 500 },
            );
        }

        const actionRows = (ownedActions || []) as { id: string; name: string }[];
        if (actionRows.length === 0) {
            return NextResponse.json<ApiData<PendingEditsSummaryResponseDto>>({
                success: true,
                message: "获取成功",
                data: { totalPending: 0, actions: [] },
            });
        }

        const actionIds = actionRows.map((a) => a.id);
        const nameMap = new Map(actionRows.map((a) => [a.id, a.name]));

        const { data: edits, error: editsError } = await supabase
            .from("community_action_edits")
            .select("action_id")
            .eq("status", "pending")
            .in("action_id", actionIds);

        if (editsError) {
            console.error("[public-action-lib] pending-edits-summary edits error:", editsError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取待审核编辑失败", data: null },
                { status: 500 },
            );
        }

        const counts = new Map<string, number>();
        for (const e of edits || []) {
            const id = (e as any).action_id;
            counts.set(id, (counts.get(id) || 0) + 1);
        }

        const actions = Array.from(counts.entries())
            .map(([actionId, pendingCount]) => ({
                actionId,
                name: nameMap.get(actionId) || "未命名动作",
                pendingCount,
            }))
            .sort((a, b) => b.pendingCount - a.pendingCount);

        const totalPending = actions.reduce((sum, a) => sum + a.pendingCount, 0);

        return NextResponse.json<ApiData<PendingEditsSummaryResponseDto>>({
            success: true,
            message: "获取成功",
            data: { totalPending, actions },
        });
    } catch (e) {
        console.error("[public-action-lib] pending-edits-summary unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

