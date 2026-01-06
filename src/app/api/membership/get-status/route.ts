import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { StudentMembership } from "@/app/service/studentMembershipService";

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
    const targetUserId = userId || session.user.id;

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
