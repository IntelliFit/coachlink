import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetImpromptuExecutionDto,
    GetImpromptuExecutionResponseDto,
} from "./entity";
import { attachImpromptuSetVideos } from "../_helpers/setVideoUpload";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = session.user.id;
        const { id } = await req.json() as GetImpromptuExecutionDto;
        if (!id) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "缺少执行ID",
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
                message: "记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (data.student_id !== userId) {
            return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }
        const hydrated = await attachImpromptuSetVideos(data as any);


        return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
            success: true,
            message: "获取成功",
            data: hydrated,
        });
    } catch (error) {
        console.error("get impromptu error:", error);
        return NextResponse.json<ApiData<GetImpromptuExecutionResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

