import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { fenToYuan } from "@/lib/moneyUtils";

export interface WalletData {
    balance: number;
    total_income: number;
    frozen_amount: number;
    transactions: Transaction[];
}

export interface Transaction {
    id: string;
    amount: number;
    type: "income" | "withdrawal" | "refund";
    description: string;
    created_at: string;
    subject?: string | null;
    order_type?: string | null;
    student_id?: string | null;
    student_name?: string | null;
    /** 关联的支付宝订单 id，用于退款等操作 */
    related_order_id?: string | null;
}

type WalletTransactionRow = {
    id: string;
    wallet_id: string | null;
    amount: number | null;
    type: "income" | "withdrawal" | "refund";
    description: string | null;
    related_order_id: string | null;
    created_at: string;
};

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // Get coach ID from user ID
    const { data: coach } = await supabase.from("coaches").select("id").eq(
        "user_id",
        session.user.id,
    ).single();
    if (!coach) {
        return NextResponse.json({
            success: false,
            message: "未找到教练信息",
            data: null,
        }, { status: 404 });
    }

    // Get Wallet
    const { data: wallet } = await supabase.from("coach_wallets").select("*")
        .eq("coach_id", coach.id).single();

    // Get Transactions
    const { data: transactionRows } = await supabase.from("wallet_transactions")
        .select("id, wallet_id, amount, type, description, related_order_id, created_at")
        .eq("wallet_id", coach.id)
        .order("created_at", { ascending: false })
        .limit(20);

    let enrichedTransactions: Transaction[] = [];

    if (transactionRows && transactionRows.length > 0) {
        const orderIds = Array.from(
            new Set(
                transactionRows
                    .map((tx) => tx.related_order_id)
                    .filter((id): id is string => Boolean(id)),
            ),
        );

        let ordersById = new Map<string, {
            id: string;
            subject: string | null;
            user_id: string;
            order_type: string | null;
            order_data: Record<string, unknown> | null;
        }>();
        let profilesByUserId = new Map<string, { nickname: string | null; full_name: string | null }>();

        if (orderIds.length > 0) {
            const { data: orders } = await serviceRoleSupabase
                .from("alipay_orders")
                .select("id, subject, user_id, order_type, order_data")
                .in("id", orderIds);

            if (orders && orders.length > 0) {
                ordersById = new Map(
                    orders.map((order) => [order.id, {
                        id: order.id,
                        subject: order.subject ?? null,
                        user_id: order.user_id,
                        order_type: order.order_type ?? null,
                        order_data: (order.order_data as Record<string, unknown> | null) ?? null,
                    }]),
                );

                const userIds = Array.from(new Set(orders
                    .map((order) => order.user_id)
                    .filter((userId): userId is string => Boolean(userId)),
                ));

                if (userIds.length > 0) {
                    const { data: profiles } = await serviceRoleSupabase
                        .from("user_profiles")
                        .select("user_id, nickname, full_name")
                        .in("user_id", userIds);

                    if (profiles && profiles.length > 0) {
                        profilesByUserId = new Map(
                            profiles.map((profile) => [profile.user_id, {
                                nickname: profile.nickname ?? null,
                                full_name: profile.full_name ?? null,
                            }]),
                        );
                    }
                }
            }
        }

        enrichedTransactions = transactionRows.map((tx: WalletTransactionRow) => {
            // 数据库存储的是分（整数），转换为元（小数）返回给前端
            const amountFen = Number(tx.amount ?? 0);
            const base: Transaction = {
                id: tx.id,
                amount: fenToYuan(amountFen), // 转换为元显示
                type: tx.type,
                description: tx.description ?? "",
                created_at: tx.created_at,
                related_order_id: tx.related_order_id ?? null,
            };

            const order = tx.related_order_id ? ordersById.get(tx.related_order_id) : null;

            if (order) {
                const orderData = (order.order_data ?? {}) as Record<string, unknown>;
                const profile = profilesByUserId.get(order.user_id);

                const getString = (value: unknown) => {
                    if (typeof value === "string") {
                        const trimmed = value.trim();
                        return trimmed.length > 0 ? trimmed : null;
                    }
                    return null;
                };

                const studentName = getString(profile?.nickname)
                    ?? getString(profile?.full_name)
                    ?? getString(orderData["studentName"])
                    ?? getString(orderData["studentNickname"]);

                const displayName = studentName ?? "学员";

                base.subject = order.subject ?? null;
                base.order_type = order.order_type ?? null;
                base.student_id = order.user_id;
                base.student_name = studentName ?? null;

                if (!base.description && order.subject) {
                    base.description = order.subject;
                }

                if (order.order_type === "subscription" || order.order_type === "subscription_renew") {
                    base.description = `来自${displayName}的订阅`;
                }
            } else if (!base.description) {
                base.description = base.type === "income" ? "课程收入" : base.type === "withdrawal" ? "提现" : "退款";
            }

            return base;
        });
    }

    // 数据库存储的是分（整数），转换为元（小数）返回给前端
    const result: WalletData = {
        balance: fenToYuan(wallet?.balance || 0),
        total_income: fenToYuan(wallet?.total_income || 0),
        frozen_amount: fenToYuan(wallet?.frozen_amount || 0),
        transactions: enrichedTransactions,
    };

    return NextResponse.json<ApiData<WalletData>>({
        success: true,
        message: "获取钱包信息成功",
        data: result,
    });
}
