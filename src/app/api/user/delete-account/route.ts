import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { hashPassword } from "@/app/api/auth/[...nextauth]/verify";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { DeleteAccountDto, DeleteAccountResponseDto } from "./entity";

const REQUIRED_CONFIRMATION_TEXT = "注销账号";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const { confirmationText } = await req.json() as DeleteAccountDto;
    if ((confirmationText || "").trim() !== REQUIRED_CONFIRMATION_TEXT) {
        return NextResponse.json({
            success: false,
            message: `请输入“${REQUIRED_CONFIRMATION_TEXT}”以确认操作`,
            data: null,
        }, { status: 200 });
    }

    // 不直接物理删除，避免跨表外键导致级联失败；
    // 但注销后需要同步结束当前教练-学员关系，避免该账号继续出现在教练后台。
    const randomPasswordHash = hashPassword(`deactivated-${randomUUID()}`);
    const nowIso = new Date().toISOString();

    const { error: userError } = await supabase
        .from("users")
        .update({
            phone: null,
            email: null,
            wechat_openid: null,
            invitation_coach_id: null,
            password_hash: randomPasswordHash,
            updated_at: nowIso,
        })
        .eq("id", session.user.id);

    if (userError) {
        return NextResponse.json({
            success: false,
            message: "注销失败，请稍后重试",
            data: null,
        }, { status: 500 });
    }

    const [profileResult, subscriptionsResult] = await Promise.all([
        serviceRoleSupabase
            .from("user_profiles")
            .update({
                nickname: null,
                full_name: null,
                avatar_url: null,
                phone: null,
                search_id: null,
                updated_at: nowIso,
            })
            .eq("user_id", session.user.id),
        serviceRoleSupabase
            .from("coach_subscriptions")
            .update({
                status: "cancelled",
                updated_at: nowIso,
            })
            .eq("student_id", session.user.id)
            .in("status", ["active", "paused"]),
    ]);

    if (profileResult.error || subscriptionsResult.error) {
        console.error("[delete-account] post-deactivation cleanup failed", {
            userId: session.user.id,
            profileError: profileResult.error?.message || null,
            subscriptionsError: subscriptionsResult.error?.message || null,
        });
        return NextResponse.json({
            success: false,
            message: "账号已停用，但关联数据清理失败，请稍后重试",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteAccountResponseDto>>({
        success: true,
        message: "账号已注销",
        data: { success: true },
    });
}
