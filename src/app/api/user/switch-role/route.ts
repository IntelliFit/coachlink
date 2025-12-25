import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

interface SwitchRoleDto {
    role: "student" | "coach";
}

interface SwitchRoleResponseDto {
    primary_role: string;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const body: SwitchRoleDto = await req.json();

    // 验证角色值
    if (!["student", "coach"].includes(body.role)) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "无效的角色值，必须是 student 或 coach",
            data: null,
        }, { status: 400 });
    }

    // 如果切换到教练端，需要验证用户是否有教练权限
    if (body.role === "coach") {
        if (!session.user.is_coach) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "您没有教练权限，请先申请成为教练",
                data: null,
            }, { status: 403 });
        }
    }

    // 更新用户的 primary_role
    const { error } = await supabase
        .from("users")
        .update({ primary_role: body.role })
        .eq("id", session.user.id);

    if (error) {
        console.error("切换角色失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "切换角色失败: " + error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<SwitchRoleResponseDto>>({
        success: true,
        message: body.role === "coach" ? "已切换到教练端" : "已切换到学员端",
        data: {
            primary_role: body.role,
        },
    });
}
