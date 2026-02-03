import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { UpdateActionRequest, UpdateActionResponse } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const body: UpdateActionRequest = await req.json();
    const { id, ...updateData } = body;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
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

    // Check if action belongs to this coach
    const { data: existingAction, error: fetchError } = await supabase
        .from("coach_actions")
        .select("id, url")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (fetchError || !existingAction) {
        return NextResponse.json({
            success: false,
            message: "Action not found or unauthorized"
        }, { status: 404 });
    }

    // 如果替换/清空了演示视频，并且旧链接来自本项目 Storage，则尝试删除旧文件，避免堆积
    const storageUrl = process.env.NEXT_SUPABASE_URL;
    const nextUrl = (updateData as any)?.url;
    const prevUrl = (existingAction as any)?.url;

    const tryRemoveOldVideo = async () => {
        if (!storageUrl) return;
        if (!prevUrl || typeof prevUrl !== "string") return;
        if (typeof nextUrl !== "string") return; // 未更新 url 则不处理
        if (prevUrl === nextUrl) return;
        if (!prevUrl.includes(storageUrl)) return;

        // 兼容 /videos/ 解析（项目里其它上传也使用这个策略）
        const parts = prevUrl.split("/videos/");
        if (parts.length !== 2) return;
        const rawPath = parts[1];
        const filePath = rawPath.split("?")[0];
        if (!filePath) return;

        const { error: storageError } = await supabase.storage
            .from("videos")
            .remove([filePath]);

        if (storageError) {
            console.error("删除旧动作演示视频失败:", storageError);
        }
    };

    await tryRemoveOldVideo();

    // Update action
    const { data: action, error } = await supabase
        .from("coach_actions")
        .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("coach_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating action:", error);
        // 检查是否是唯一约束冲突（同名动作已存在）
        if (error.code === '23505' || error.message?.includes('unique_coach_action_name')) {
            return NextResponse.json({
                success: false,
                message: "该名称的动作已存在，请使用其他名称"
            }, { status: 409 });
        }
        return NextResponse.json({
            success: false,
            message: "Failed to update action"
        }, { status: 500 });
    }

    const response: UpdateActionResponse = {
        success: true,
        action
    };

    return NextResponse.json<ApiData<UpdateActionResponse>>({
        success: true,
        message: "更新动作成功",
        data: response
    });
}