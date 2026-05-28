import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    importAdminContentBundle,
    type AdminContentImportBundle,
} from "@/lib/adminContentImport";
import type { ApiData } from "@/types/api";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    const user = session?.user as { id?: string; is_admin?: boolean } | undefined;
    if (!user?.id) return { ok: false as const, status: 401, message: "用户未登录" };
    if (!user.is_admin) {
        return { ok: false as const, status: 403, message: "权限不足" };
    }
    return { ok: true as const, userId: user.id };
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const bundle = (body?.bundle || body) as AdminContentImportBundle;
    const result = await importAdminContentBundle(bundle, {
        adminUserId: auth.userId,
        publish: body?.publish === true,
        dryRun: body?.dryRun === true,
    });

    return NextResponse.json<ApiData<typeof result>>({
        success: result.ok,
        message: result.ok
            ? (result.dryRun ? "内容导入校验通过" : "内容导入完成")
            : "内容导入校验失败",
        data: result,
    }, { status: result.ok ? 200 : 422 });
}
