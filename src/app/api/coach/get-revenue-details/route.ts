import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan } from "@/lib/moneyUtils";
import type { ApiData } from "@/types/api";
import type {
    GetRevenueDetailsDto,
    GetRevenueDetailsResponseDto,
    RevenueItem,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

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

    // 解析请求参数
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

    const items: RevenueItem[] = [];

    // 1. 查询订阅收入（active 订阅）
    // monthly_price 在 DB 中为分
    const { data: subscriptions } = await supabase
        .from("coach_subscriptions")
        .select(`
            id,
            monthly_price,
            created_at,
            student_id,
            users:student_id (
                id,
                nickname,
                profile
            )
        `)
        .eq("coach_id", coachId)
        .eq("status", "active");

    let subscriptionRevenueFen = 0;
    if (subscriptions) {
        for (const sub of subscriptions) {
            const amountFen = Number(sub.monthly_price) || 0;
            subscriptionRevenueFen += amountFen;

            const user = sub.users as any;
            const studentName = user?.nickname
                || user?.profile?.name
                || "未知学员";

            items.push({
                id: sub.id,
                type: "subscription",
                amount: fenToYuan(amountFen),  // 转为元
                description: `订阅月费 - ${studentName}`,
                createdAt: sub.created_at,
                studentName,
            });
        }
    }

    // 2. 查询内容购买收入（当月已支付）
    let contentPurchaseRevenueFen = 0;
    try {
        // 获取教练的所有内容 ID
        const { data: contents } = await serviceRoleSupabase
            .from("coach_contents")
            .select("id, title")
            .eq("coach_id", coachId);

        const contentMap = new Map<string, string>();
        const contentIds: string[] = [];
        if (contents) {
            for (const c of contents) {
                contentIds.push(c.id);
                contentMap.set(c.id, c.title || "未命名文章");
            }
        }

        if (contentIds.length > 0) {
            const { data: purchases } = await serviceRoleSupabase
                .from("content_purchases" as any)
                .select(`
                    id,
                    content_id,
                    user_id,
                    order_id,
                    paid_at,
                    users:user_id (
                        id,
                        nickname,
                        profile
                    )
                `)
                .in("content_id", contentIds)
                .eq("status", "paid")
                .gte("paid_at", monthStart.toISOString())
                .lt("paid_at", nextMonthStart.toISOString());

            if (purchases && purchases.length > 0) {
                const orderIds = purchases
                    .map((p: any) => p.order_id)
                    .filter((id: any) => typeof id === "string" && id.length > 0);

                const orderAmountMap = new Map<string, number>();
                if (orderIds.length > 0) {
                    const { data: orders } = await serviceRoleSupabase
                        .from("alipay_orders")
                        .select("id, total_amount")
                        .in("id", orderIds)
                        .eq("status", "paid")
                        .eq("order_type", "content_purchase");

                    if (orders) {
                        for (const o of orders) {
                            // alipay_orders.total_amount 也可能是分
                            orderAmountMap.set(o.id, Number(o.total_amount) || 0);
                        }
                    }
                }

                for (const p of purchases as any[]) {
                    const amountFen = orderAmountMap.get(p.order_id) || 0;
                    contentPurchaseRevenueFen += amountFen;

                    const contentTitle = contentMap.get(p.content_id) || "未命名文章";
                    const user = p.users as any;
                    const buyerName = user?.nickname || user?.profile?.name || "匿名用户";

                    items.push({
                        id: p.id,
                        type: "content_purchase",
                        amount: fenToYuan(amountFen),  // 转为元
                        description: `文章购买 - ${contentTitle}`,
                        createdAt: p.paid_at,
                        studentName: buyerName,
                        contentTitle,
                    });
                }
            }
        }
    } catch (e) {
        console.error("[get-revenue-details] content purchase query failed:", e);
    }

    // 按时间倒序排列
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 转为元返回（与概览页一致）
    const subscriptionRevenue = fenToYuan(subscriptionRevenueFen);
    const contentPurchaseRevenue = fenToYuan(contentPurchaseRevenueFen);
    const totalRevenue = subscriptionRevenue + contentPurchaseRevenue;

    return NextResponse.json<ApiData<GetRevenueDetailsResponseDto>>({
        success: true,
        message: "获取收入明细成功",
        data: {
            subscriptionRevenue,
            contentPurchaseRevenue,
            totalRevenue,
            items,
        },
    });
}
