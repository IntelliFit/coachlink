import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import { buildCoachMonthlyRevenueSummary } from "@/lib/coachRevenueSummary";
import type { ApiData } from "@/types/api";
import type {
    GetRevenueDetailsDto,
    GetRevenueDetailsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = authResult.userId;

    // 获取教练 ID
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: "教练不存在",
            data: null,
        }, { status: 404 });
    }

    const coachId = coach.id;

    let reqData: GetRevenueDetailsDto = {};
    try {
        reqData = await req.json();
    } catch {
        // 使用默认值
    }

    // 计算月份范围
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (reqData.month) {
        const parts = reqData.month.split("-");
        if (parts.length === 2) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
        }
    }

    const monthStart = new Date(year, month, 1);
    const nextMonthStart = new Date(year, month + 1, 1);

    let summary;
    try {
        summary = await buildCoachMonthlyRevenueSummary({
            coachId,
            monthStart,
            nextMonthStart,
            includeItems: true,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : "收入明细加载失败",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetRevenueDetailsResponseDto>>({
        success: true,
        message: "获取收入明细成功",
        data: {
            subscriptionRevenue: summary.subscriptionRevenue,
            contentPurchaseRevenue: summary.contentPurchaseRevenue,
            totalRevenue: summary.totalRevenue,
            items: summary.items,
        },
    });
}
