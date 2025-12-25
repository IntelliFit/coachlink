import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import type {
    ListTrainingItemsDto,
    ListTrainingItemsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<ListTrainingItemsResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        // 获取所有训练项目
        const { data: trainingItems, error } = await supabase
            .from("training_items")
            .select("*")
            .order("name");

        if (error) {
            console.error("获取训练项目列表失败:", error);
            return NextResponse.json<ApiData<ListTrainingItemsResponseDto>>({
                success: false,
                message: "获取训练项目列表失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<ListTrainingItemsResponseDto>>({
            success: true,
            message: "训练项目列表获取成功",
            data: {
                trainingItems: trainingItems || [],
            },
        });
    } catch (error) {
        console.error("获取训练项目列表异常:", error);
        return NextResponse.json<ApiData<ListTrainingItemsResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
