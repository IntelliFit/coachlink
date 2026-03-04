import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { hashPassword } from "@/app/api/auth/[...nextauth]/verify";
import supabase from "@/lib/supabaseClient";
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

    // 不直接物理删除，避免跨表外键导致的级联失败；
    // 通过清空登录凭据 + 重置随机密码来禁用账号登录。
    const randomPasswordHash = hashPassword(`deactivated-${randomUUID()}`);

    const { error } = await supabase
        .from("users")
        .update({
            phone: null,
            email: null,
            wechat_openid: null,
            password_hash: randomPasswordHash,
            updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

    if (error) {
        return NextResponse.json({
            success: false,
            message: "注销失败，请稍后重试",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteAccountResponseDto>>({
        success: true,
        message: "账号已注销",
        data: { success: true },
    });
}
