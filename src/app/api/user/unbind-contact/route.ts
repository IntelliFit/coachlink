import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { UnbindContactDto, UnbindContactResponseDto } from "./entity";
import { hasStandaloneAdminCredentialForUserId } from "@/lib/adminCredentials";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const body = (await req.json()) as UnbindContactDto;
    const type = body?.type;
    if (!type || (type !== "phone" && type !== "email" && type !== "wechat")) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "解绑类型不正确",
            data: null,
        });
    }

    const { data: user, error: userError } = await serviceRoleSupabase
        .from("users")
        .select("id, phone, email, wechat_openid")
        .eq("id", session.user.id)
        .single();

    if (userError || !user) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户不存在", data: null },
            { status: 404 },
        );
    }

    const nextPhone = type === "phone" ? null : user.phone;
    const nextEmail = type === "email" ? null : user.email;
    const nextWechat = type === "wechat" ? null : user.wechat_openid;
    const hasStandaloneAdminCredential = await hasStandaloneAdminCredentialForUserId(session.user.id);

    if (!nextPhone && !nextEmail && !nextWechat && !hasStandaloneAdminCredential) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "至少保留一种登录方式；如果这是管理员账号，请先在管理端配置独立登录凭证",
            data: null,
        });
    }

    const patch =
        type === "wechat"
            ? { wechat_openid: null }
            : type === "phone"
                ? { phone: null }
                : { email: null };

    const { error: updateError } = await serviceRoleSupabase
        .from("users")
        .update({ ...patch, updated_at: new Date().toISOString() } as any)
        .eq("id", session.user.id);

    if (updateError) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "解绑失败，请稍后重试", data: null },
            { status: 500 },
        );
    }

    return NextResponse.json<ApiData<UnbindContactResponseDto>>({
        success: true,
        message: "解绑成功",
        data: { success: true },
    });
}
