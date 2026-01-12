import { NextRequest, NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { DeleteActionDto, DeleteActionResponseDto } from "./entity";
import type { ApiData } from "@/types/api";

export async function POST(req: NextRequest) {
    const { id }: DeleteActionDto = await req.json();

    // 验证必要参数
    if (!id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少动作ID",
            data: null
        }, { status: 400 });
    }

    // 检查用户登录状态和教练角色
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_coach')
        .eq('id', userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }


    // 检查动作是否存在且属于该教练
    const { data: existingAction, error: fetchError } = await supabase
        .from("coach_actions")
        .select("id, url")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (fetchError || !existingAction) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "动作不存在或无权访问",
            data: null
        }, { status: 404 });
    }

    // 如果演示视频来自本项目 Storage，则尝试删除文件
    try {
        const storageUrl = process.env.NEXT_SUPABASE_URL;
        const prevUrl = (existingAction as any)?.url;
        if (storageUrl && prevUrl && typeof prevUrl === "string" && prevUrl.includes(storageUrl)) {
            const parts = prevUrl.split("/videos/");
            if (parts.length === 2) {
                const rawPath = parts[1];
                const filePath = rawPath.split("?")[0];
                if (filePath) {
                    const { error: storageError } = await supabase.storage
                        .from("videos")
                        .remove([filePath]);
                    if (storageError) {
                        console.error("删除动作演示视频失败:", storageError);
                    }
                }
            }
        }
    } catch (e) {
        console.error("删除动作演示视频异常:", e);
    }

    // 删除动作
    const { error } = await supabase
        .from("coach_actions")
        .delete()
        .eq("id", id)
        .eq("coach_id", userId);

    if (error) {
        console.error("删除动作失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "删除动作失败",
            data: null
        }, { status: 500 });
    }


    return NextResponse.json<ApiData<DeleteActionResponseDto>>({
        success: true,
        message: "删除动作成功",
        data: '删除成功'
    });
}