import { NextResponse } from "next/server";
import { getServerSession } from "../@/app/api/auth/[...nextauth]/auth";
import supabase from '@/lib/supabaseClient';
import { ApiData } from "@/types/api";
import type { GetTrainingItemDto, GetTrainingItemResponseDto } from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetTrainingItemResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null
            }, { status: 401 });
        }

        const {
            id
        } = await req.json() as GetTrainingItemDto;

        // 参数校验
        if (!id) {
            return NextResponse.json<ApiData<GetTrainingItemResponseDto>>({
                success: false,
                message: "训练项目ID不能为空",
                data: null
            }, { status: 400 });
        }

        // 获取训练项目
        const { data: trainingItem, error } = await supabase
            .from("training_items")
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error("获取训练项目失败:", error);
            return NextResponse.json<ApiData<GetTrainingItemResponseDto>>({
                success: false,
                message: "获取训练项目失败",
                data: null
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<GetTrainingItemResponseDto>>({
            success: true,
            message: "训练项目获取成功",
            data: {
                trainingItem
            }
        });
    } catch (error) {
        console.error("获取训练项目异常:", error);
        return NextResponse.json<ApiData<GetTrainingItemResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null
        }, { status: 500 });
    }
}