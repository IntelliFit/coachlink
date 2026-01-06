import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

export interface Coupon {
    id: string;
    type: "discount_cash" | "duration_gift";
    value: number;
    condition_min_amount: number;
    category_limit?: string;
    status: "unused" | "used" | "expired";
    expires_at: string | null;
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

    const { userId } = await request.json();
    const targetUserId = userId || session.user.id; // User can only list their own coupons

    const { data: coupons, error } = await supabase
        .from("student_coupons")
        .select("*")
        .eq("user_id", targetUserId)
        .in("status", ["unused"]) // Only list unused coupons by default
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching list-coupons:", error);
        return NextResponse.json({
            success: false,
            message: "获取优惠券失败",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<Coupon[]>>({
        success: true,
        message: "获取优惠券成功",
        data: coupons || [],
    });
}
