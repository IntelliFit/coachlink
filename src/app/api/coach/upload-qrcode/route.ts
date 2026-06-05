import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export async function POST() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const { data: coach, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (error || !coach) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "您不是教练", data: null },
            { status: 403 },
        );
    }

    return NextResponse.json<ApiData<null>>(
        {
            success: false,
            message: "个人收款码已停用，教练收款统一通过汇付账户",
            data: null,
        },
        { status: 410 },
    );
}
