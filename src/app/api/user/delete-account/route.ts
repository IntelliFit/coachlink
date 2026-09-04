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

    // 先建立可追踪、可重试的数据删除工单，再停用登录身份。这样即时清理即使部分失败，
    // 管理后台仍能继续处理关联训练、聊天、视频和依法保留数据的删除/去标识化。
    const { data: existingRequest, error: existingRequestError } = await serviceRoleSupabase
        .from("feedbacks")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("related_question", "account_deletion")
        .in("status", ["open", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingRequestError) {
        console.error("[delete-account] failed to find existing deletion request", existingRequestError);
        return NextResponse.json({
            success: false,
            message: "暂时无法检查数据删除申请，请稍后重试",
            data: null,
        }, { status: 500 });
    }

    let deletionRequestId = existingRequest?.id || "";
    if (!deletionRequestId) {
        const { data: deletionRequest, error: deletionRequestError } = await serviceRoleSupabase
            .from("feedbacks")
            .insert({
                user_id: session.user.id,
                content: "[账号与关联数据删除申请] 用户已通过账号设置完成身份确认并申请注销。请继续处理关联个人数据的删除或去标识化，并核对依法需要保留的交易、安全与争议记录。",
                related_question: "account_deletion",
                status: "open",
            })
            .select("id")
            .single();

        if (deletionRequestError || !deletionRequest?.id) {
            console.error("[delete-account] failed to create deletion request", deletionRequestError);
            return NextResponse.json({
                success: false,
                message: "暂时无法建立数据删除申请，请稍后重试",
                data: null,
            }, { status: 500 });
        }
        deletionRequestId = deletionRequest.id;
    }

    // 不直接物理删除，避免跨表外键导致级联失败；
    // 先停用登录身份并清理公开资料，其他关联数据由上面的删除工单继续追踪。
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

    const immediateCleanupComplete = !profileResult.error && !subscriptionsResult.error;
    if (!immediateCleanupComplete) {
        console.error("[delete-account] post-deactivation cleanup failed", {
            userId: session.user.id,
            deletionRequestId,
            profileError: profileResult.error?.message || null,
            subscriptionsError: subscriptionsResult.error?.message || null,
        });
    }

    return NextResponse.json<ApiData<DeleteAccountResponseDto>>({
        success: true,
        message: immediateCleanupComplete
            ? "账号已停用，关联数据删除申请已提交"
            : "账号已停用，关联数据删除申请已提交；部分即时清理将由平台继续处理",
        data: {
            success: true,
            deletionRequestId,
            pendingDataDeletion: true,
        },
    });
}
