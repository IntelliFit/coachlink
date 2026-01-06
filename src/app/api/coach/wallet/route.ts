import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

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
}

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
    const { data: transactions } = await supabase.from("wallet_transactions")
        .select("*")
        .eq("wallet_id", coach.id)
        .order("created_at", { ascending: false })
        .limit(20);

    const result: WalletData = {
        balance: wallet?.balance || 0,
        total_income: wallet?.total_income || 0,
        frozen_amount: wallet?.frozen_amount || 0,
        transactions: transactions || [],
    };

    return NextResponse.json<ApiData<WalletData>>({
        success: true,
        message: "获取钱包信息成功",
        data: result,
    });
}
