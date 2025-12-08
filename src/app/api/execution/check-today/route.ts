import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";

/**
 * GET /api/execution/check-today
 *
 * 检查今天是否有执行记录
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get("instanceId");
        const dayIndex = parseInt(searchParams.get("dayIndex") || "1");

        if (!instanceId) {
            return NextResponse.json({ success: false, message: "缺少参数" }, {
                status: 400,
            });
        }

        // 查询今天的执行记录
        const today = new Date().toISOString().split("T")[0];

        const { data, error } = await supabase
            .from("plan_instance_executions" as any)
            .select(
                "id, status, completed_sets, total_sets, started_at, completed_at",
            )
            .eq("instance_id", instanceId)
            .eq("dayIndex", dayIndex)
            .eq("student_id", userId)
            .gte("started_at", today)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("查询执行记录失败:", error);
            return NextResponse.json({ success: false, message: "查询失败" }, {
                status: 500,
            });
        }

        if (!data) {
            return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({
            success: true,
            data: {
                id: data.id,
                status: data.status,
                completed_sets: data.completed_sets,
                total_sets: data.total_sets,
                started_at: data.started_at,
                completed_at: data.completed_at,
            },
        });
    } catch (error) {
        console.error("检查执行状态失败:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
