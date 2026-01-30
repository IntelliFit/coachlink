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
    // 注意：订阅是按月计费的，这里简单起见列出所有 active 订阅作为"本月"的预期收入
    const { data: subscriptions } = await supabase
        .from("coach_subscriptions")
        .select(`
            id,
            monthly_price,
            created_at,
            student_id
        `)
        .eq("coach_id", coachId)
        .eq("status", "active");

    // 2. 查询内容购买收入
    // 先获取 content ids
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

    let purchases: any[] = [];
    if (contentIds.length > 0) {
        const { data: pData } = await serviceRoleSupabase
            .from("content_purchases" as any)
            .select(`
                id,
                content_id,
                user_id,
                order_id,
                paid_at
            `)
            .in("content_id", contentIds)
            .eq("status", "paid")
            .gte("paid_at", monthStart.toISOString())
            .lt("paid_at", nextMonthStart.toISOString());
        purchases = pData || [];
    }

    // 3. 收集所有涉及的用户 ID，批量查询 user_profiles 获取名字
    const userIds = new Set<string>();
    if (subscriptions) {
        subscriptions.forEach(sub => sub.student_id && userIds.add(sub.student_id));
    }
    purchases.forEach(p => p.user_id && userIds.add(p.user_id));

    const userProfileMap = new Map<string, string>();
    if (userIds.size > 0) {
        const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, nickname")
            .in("user_id", Array.from(userIds));

        if (profiles) {
            profiles.forEach((p: any) => {
                if (p.user_id && p.nickname) {
                    userProfileMap.set(p.user_id, p.nickname);
                }
            });
        }
    }

    // 4. 处理订阅收入数据
    let subscriptionRevenueFen = 0;
    if (subscriptions) {
        for (const sub of subscriptions) {
            const amountFen = Number(sub.monthly_price) || 0;
            subscriptionRevenueFen += amountFen;

            const studentName = userProfileMap.get(sub.student_id) || "未知学员";

            items.push({
                id: sub.id,
                type: "subscription",
                amount: fenToYuan(amountFen),
                description: `订阅月费 - ${studentName}`,
                createdAt: sub.created_at,
                studentName,
            });
        }
    }

    // 5. 处理内容购买数据
    let contentPurchaseRevenueFen = 0;
    if (purchases.length > 0) {
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
                    orderAmountMap.set(o.id, Number(o.total_amount) || 0);
                }
            }
        }

        for (const p of purchases) {
            const amountFen = orderAmountMap.get(p.order_id) || 0;
            contentPurchaseRevenueFen += amountFen;

            const contentTitle = contentMap.get(p.content_id) || "未命名文章";
            const buyerName = userProfileMap.get(p.user_id) || "匿名用户";

            items.push({
                id: p.id,
                type: "content_purchase",
                amount: fenToYuan(amountFen),
                description: `文章购买 - ${contentTitle}`,
                createdAt: p.paid_at,
                studentName: buyerName,
                contentTitle,
            });
        }
    }

    // 6. 排序与汇总
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
