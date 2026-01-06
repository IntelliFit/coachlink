import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { StudentQuota } from "@/app/service/studentMembershipService";

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

    // Fetch quotas
    const { data: quota, error } = await supabase
        .from("student_quotas")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching quota:", error);
        return NextResponse.json({
            success: false,
            message: "获取配额信息失败",
            data: null,
        }, { status: 500 });
    }

    // Default quotas if no record
    const result: StudentQuota = quota || {
        user_id: targetUserId,
        ai_import_balance: 0,
        storage_total_mb: 0,
        storage_used_mb: 0,
    };

    return NextResponse.json<ApiData<StudentQuota>>({
        success: true,
        message: "获取配额信息成功",
        data: result,
    });
}
