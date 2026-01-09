import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import type {
    DeleteTrainingItemDto,
    DeleteTrainingItemResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

        // 检查用户是否为教练
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("is_coach")
            .eq("id", userId)
            .single();

        if (userError || !user) {
            return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
                success: false,
                message: "用户信息获取失败",
                data: null,
            }, { status: 400 });
        }

        if (!user.is_coach) {
            return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
                success: false,
                message: "权限不足，仅教练可执行此操作",
                data: null,
            }, { status: 403 });
        }

        const {
            id,
        } = await req.json() as DeleteTrainingItemDto;

        // 参数校验
        if (!id) {
            return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
                success: false,
                message: "训练项目ID不能为空",
                data: null,
            }, { status: 400 });
        }

        // 删除训练项目
        const { error } = await supabase
            .from("training_items")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("删除训练项目失败:", error);
            return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
                success: false,
                message: "删除训练项目失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
            success: true,
            message: "训练项目删除成功",
            data: {
                success: true,
            },
        });
    } catch (error) {
        console.error("删除训练项目异常:", error);
        return NextResponse.json<ApiData<DeleteTrainingItemResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
