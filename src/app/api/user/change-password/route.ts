import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import {
    hashPassword,
    verifyPassword,
} from "@/app/api/auth/[...nextauth]/verify";
import { ApiData } from "@/types/api";
import { ChangePasswordDto, ChangePasswordResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const {
        oldPassword,
        newPassword,
    } = await req.json() as ChangePasswordDto;

    const trimmedOldPassword = oldPassword?.trim();
    const trimmedNewPassword = newPassword?.trim();

    if (!trimmedOldPassword || !trimmedNewPassword) {
        return NextResponse.json({
            success: false,
            message: "原密码和新密码不能为空",
            data: null,
        }, { status: 200 });
    }

    if (trimmedOldPassword === trimmedNewPassword) {
        return NextResponse.json({
            success: false,
            message: "新密码不能与原密码相同",
            data: null,
        }, { status: 200 });
    }

    // 获取用户当前哈希
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", session.user.id)
        .single();

    if (userError || !user) {
        return NextResponse.json({
            success: false,
            message: "用户不存在",
            data: null,
        }, { status: 404 });
    }

    // 验证旧密码
    const isValid = verifyPassword(trimmedOldPassword, user.password_hash);
    if (!isValid) {
        return NextResponse.json({
            success: false,
            message: "原密码错误",
            data: null,
        }, { status: 200 });
    }

    // 生成新哈希
    const newHash = hashPassword(trimmedNewPassword);

    // 更新数据库
    const { error: updateError } = await supabase
        .from("users")
        .update({
            password_hash: newHash,
            updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

    if (updateError) {
        return NextResponse.json({
            success: false,
            message: "密码更新失败，请重试",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ChangePasswordResponseDto>>({
        success: true,
        message: "密码修改成功",
        data: { success: true },
    });
}
