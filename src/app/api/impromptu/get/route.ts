import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetImpromptuExecutionDto,
    GetImpromptuExecutionResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "鐢ㄦ埛鏈櫥褰?",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const { id } = await req.json() as GetImpromptuExecutionDto;
        if (!id) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "缂哄皯鎵цID",
                data: null,
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "璁板綍涓嶅瓨鍦?",
                data: null,
            }, { status: 404 });
        }
        if (data.student_id !== userId) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "鏃犳潈闄?",
                data: null,
            }, { status: 403 });
        }

        const actionExecutions = Array.isArray(data.action_executions)
            ? data.action_executions
            : [];
        const actionIds = Array.from(
            new Set(
                actionExecutions
                    .map((item: any) => String(item?.action_id || "").trim())
                    .filter(Boolean),
            ),
        );

        const actionMetaById = new Map<string, { type: string | null; attrs: string[] | null }>();
        if (actionIds.length > 0) {
            const { data: actionRows } = await supabase
                .from("student_actions")
                .select("id, type, attrs")
                .eq("user_id", userId)
                .in("id", actionIds);

            (actionRows || []).forEach((item: any) => {
                actionMetaById.set(String(item.id), {
                    type: item.type || "STRENGTH",
                    attrs: Array.isArray(item.attrs) ? item.attrs : null,
                });
            });
        }

        return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
            success: true,
            message: "鑾峰彇鎴愬姛",
            data: {
                ...data,
                action_executions: actionExecutions.map((item: any) => {
                    const actionId = String(item?.action_id || "").trim();
                    const meta = actionId ? actionMetaById.get(actionId) : null;
                    return {
                        ...item,
                        type: item?.type || meta?.type || "STRENGTH",
                        attrs: item?.attrs || meta?.attrs || null,
                    };
                }),
            },
        });
    } catch (error) {
        console.error("get impromptu error:", error);
        return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
            success: false,
            message: "鏈嶅姟鍣ㄩ敊璇?",
            data: null,
        }, { status: 500 });
    }
}
