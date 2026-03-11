import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { ListImpromptuActionsResponseDto } from "./entity";

export async function POST() {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const { data, error } = await supabase
            .from("student_actions")
            .select("id, name, type")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(200);

        if (error) {
            return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
                success: false,
                message: "获取动作列表失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
            success: true,
            message: "获取动作列表成功",
            data: {
                actions: (data || []).map((item) => ({
                    id: item.id,
                    name: item.name,
                    type: item.type || "STRENGTH",
                })),
            },
        });
    } catch (error) {
        console.error("list impromptu actions error:", error);
        return NextResponse.json<ApiData<ListImpromptuActionsResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

