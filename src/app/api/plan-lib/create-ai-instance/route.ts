import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { CreateAiInstanceDto, CreateAiInstanceResponseDto } from "./entity";
import { ApiError, createAiInstanceForSubscription } from "./service";

export async function POST(req: Request) {
    const {
        subscriptionId,
        startWeek,
        startDay,
        keepOriginalIndex = true,
    } = await req.json() as CreateAiInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    try {
        // Verify coach identity once
        const { data: coachRow, error: coachErr } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (coachErr) {
            return NextResponse.json({ success: false, message: coachErr.message }, { status: 500 });
        }

        if (!coachRow?.id) {
            return NextResponse.json({ success: false, message: "未找到教练身份" }, { status: 403 });
        }

        const template = await createAiInstanceForSubscription({
            actorUserId: userId,
            actorCoachId: coachRow.id,
            subscriptionId,
            startWeek,
            startDay,
            keepOriginalIndex,
        });

        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: true,
            message: "创建训练计划实例成功",
            data: { template },
        });
    } catch (e: any) {
        const status = e instanceof ApiError ? e.status : 500;
        const message = e?.message || "创建失败";
        return NextResponse.json<ApiData<CreateAiInstanceResponseDto>>({
            success: false,
            message,
            data: { template: null },
        }, { status });
    }
}
