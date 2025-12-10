import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import supabase from '@/lib/supabaseClient';
import { ApiData } from "@/types/api";
import type { CreateTrainingItemDto, CreateTrainingItemResponseDto } from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null
            }, { status: 401 });
        }

        const userId = session.user.id;

        // 检查用户是否为教练
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('is_coach')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
                success: false,
                message: "用户信息获取失败",
                data: null
            }, { status: 400 });
        }

        if (!user.is_coach) {
            return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
                success: false,
                message: "权限不足，仅教练可执行此操作",
                data: null
            }, { status: 403 });
        }

        const {
            name,
            description
        } = await req.json() as CreateTrainingItemDto;

        // 参数校验
        if (!name) {
            return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
                success: false,
                message: "训练项目名称不能为空",
                data: null
            }, { status: 400 });
        }

        // 创建训练项目
        const { data: trainingItem, error } = await supabase
            .from("training_items")
            .insert({
                name,
                description: description || null
            })
            .select()
            .single();

        if (error) {
            console.error("创建训练项目失败:", error);
            return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
                success: false,
                message: "创建训练项目失败",
                data: null
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
            success: true,
            message: "训练项目创建成功",
            data: {
                trainingItem
            }
        });
    } catch (error) {
        console.error("创建训练项目异常:", error);
        return NextResponse.json<ApiData<CreateTrainingItemResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null
        }, { status: 500 });
    }
}