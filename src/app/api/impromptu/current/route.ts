import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CurrentImpromptuExecutionResponseDto } from "./entity";
import { attachImpromptuSetVideos } from "../_helpers/setVideoUpload";

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CurrentImpromptuExecutionResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const { data, error } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("student_id", session.user.id)
            .eq("status", "in_progress")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("get current impromptu execution error:", error);
            return NextResponse.json<ApiData<CurrentImpromptuExecutionResponseDto>>({
                success: false,
                message: "查询进行中的即兴训练失败",
                data: null,
            }, { status: 500 });
        }
        const hydrated = data
            ? await attachImpromptuSetVideos(data as any)
            : null;

        return NextResponse.json<ApiData<CurrentImpromptuExecutionResponseDto>>({
            success: true,
            message: hydrated ? "获取成功" : "暂无进行中的即兴训练",
            data: hydrated,
        });
    } catch (error) {
        console.error("get current impromptu execution error:", error);
        return NextResponse.json<ApiData<CurrentImpromptuExecutionResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
