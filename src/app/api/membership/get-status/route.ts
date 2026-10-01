import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { StudentMembership } from "@/app/service/studentMembershipService";
import { isWechatFreeRequest } from '@/lib/wechatFreeRelease';

async function handle(request: NextRequest) {
    const requestUserId = await getApiUserId(request);

    const { userId: bodyUserId } = request.method === "GET"
        ? { userId: undefined }
        : await request.json().catch(() => ({}));
    const targetUserId = await isWechatFreeRequest(request) ? requestUserId : bodyUserId || requestUserId;

    if (!targetUserId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // Fetch membership status
    const { data: membership, error } = await supabase
        .from("student_memberships")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching membership:", error);
        return NextResponse.json({
            success: false,
            message: "获取会员状态失败",
            data: null,
        }, { status: 500 });
    }

    // Default to free tier if no record exists
    const result: StudentMembership = membership || {
        user_id: targetUserId,
        tier: "free",
        start_date: new Date().toISOString(),
        end_date: null,
        status: "active",
    };

    return NextResponse.json<ApiData<StudentMembership>>({
        success: true,
        message: "获取会员状态成功",
        data: result,
    });
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
