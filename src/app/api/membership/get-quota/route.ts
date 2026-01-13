import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { MEMBER_BENEFITS, StudentQuota } from "@/app/service/studentMembershipService";

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

    // If no record, lazily initialize by membership tier (default free)
    let result: StudentQuota;
    if (!quota) {
        const { data: membership } = await supabase
            .from("student_memberships")
            .select("*")
            .eq("user_id", targetUserId)
            .maybeSingle();

        const tier = (membership?.tier || "free") as keyof typeof MEMBER_BENEFITS;
        const benefits = MEMBER_BENEFITS[tier] || MEMBER_BENEFITS.free;

        const now = new Date().toISOString();
        const initRow = {
            user_id: targetUserId,
            ai_import_balance: benefits.ai_limit_monthly, // 免费=2次
            storage_total_mb: benefits.storage_mb, // 免费=50MB
            storage_used_mb: 0,
            last_reset_date: now,
            created_at: now,
        };

        const { data: inserted, error: insertError } = await supabase
            .from("student_quotas")
            .insert(initRow as any)
            .select("*")
            .single();

        if (insertError) {
            // race 或其他异常：回退为“按档位计算的默认值”，至少前端能展示正确配额
            console.warn("Failed to init quota row, fallback to computed default", insertError);
            result = {
                user_id: targetUserId,
                ai_import_balance: benefits.ai_limit_monthly,
                storage_total_mb: benefits.storage_mb,
                storage_used_mb: 0,
            };
        } else {
            result = inserted as any;
        }
    } else {
        // Existing record: return as-is (membershipLimit 会在使用时修复旧数据)
        result = quota as any;
    }

    return NextResponse.json<ApiData<StudentQuota>>({
        success: true,
        message: "获取配额信息成功",
        data: result,
    });
}
