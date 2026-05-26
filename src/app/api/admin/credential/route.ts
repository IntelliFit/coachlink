import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    getAdminCredentialByUserId,
    normalizeAdminLoginIdentifier,
} from "@/lib/adminCredentials";
import { hashPassword } from "@/app/api/auth/[...nextauth]/verify";
import type {
    GetAdminCredentialResponseDto,
    UpdateAdminCredentialDto,
    UpdateAdminCredentialResponseDto,
} from "./entity";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) {
        return { ok: false as const, status: 401, message: "用户未登录" };
    }
    if (!(session.user as { is_admin?: boolean }).is_admin) {
        return { ok: false as const, status: 403, message: "需要管理员权限" };
    }
    return { ok: true as const };
}

export async function GET() {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const userId = session!.user!.id;
    const [credential, userResult] = await Promise.all([
        getAdminCredentialByUserId(userId),
        serviceRoleSupabase
            .from("users")
            .select("phone, email")
            .eq("id", userId)
            .single(),
    ]);

    if (userResult.error || !userResult.data) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "管理员用户不存在", data: null },
            { status: 404 },
        );
    }

    const canUnbindPhone = Boolean(
        (credential?.is_active !== false && credential?.login_identifier && credential?.password_hash) ||
        userResult.data.email,
    );

    return NextResponse.json<ApiData<GetAdminCredentialResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            credential: {
                loginIdentifier: credential?.login_identifier ?? null,
                hasPassword: Boolean(credential?.password_hash),
                isActive: credential?.is_active !== false,
                role: credential?.role ?? null,
                permissions: credential?.permissions ?? null,
                linkedPhone: userResult.data.phone ?? null,
                linkedEmail: userResult.data.email ?? null,
                canUnbindPhone,
            },
        },
    });
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const body = await req.json() as UpdateAdminCredentialDto;
    const loginIdentifier = normalizeAdminLoginIdentifier(body?.loginIdentifier || "");
    const password = (body?.password || "").trim();

    if (!loginIdentifier) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "请输入管理员登录账号", data: null },
            { status: 400 },
        );
    }

    if (!/^[a-zA-Z0-9._@-]{4,64}$/.test(loginIdentifier)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "管理员登录账号仅支持 4-64 位字母、数字、点、下划线、中横线或 @", data: null },
            { status: 400 },
        );
    }

    if (password.length < 8) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "管理员密码至少 8 位", data: null },
            { status: 400 },
        );
    }

    const current = await getAdminCredentialByUserId(session!.user!.id);
    if (!current) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "当前管理员未绑定后台权限记录", data: null },
            { status: 404 },
        );
    }

    const { data: conflict, error: conflictError } = await serviceRoleSupabase
        .from("admin_users")
        .select("id")
        .eq("login_identifier", loginIdentifier)
        .maybeSingle();

    if (conflictError) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: conflictError.message, data: null },
            { status: 500 },
        );
    }

    if (conflict && conflict.id !== current.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "该管理员登录账号已被占用", data: null },
            { status: 409 },
        );
    }

    const { error: updateError } = await serviceRoleSupabase
        .from("admin_users")
        .update({
            login_identifier: loginIdentifier,
            password_hash: hashPassword(password),
            is_active: true,
            updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

    if (updateError) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: updateError.message, data: null },
            { status: 500 },
        );
    }

    return NextResponse.json<ApiData<UpdateAdminCredentialResponseDto>>({
        success: true,
        message: "管理员登录凭证已保存",
        data: {
            credential: {
                loginIdentifier,
                isActive: true,
            },
        },
    });
}
