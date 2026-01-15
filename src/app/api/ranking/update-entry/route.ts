import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { UpdateEntryDto, UpdateEntryResponseDto } from "./entity";
import { sendSystemMessage } from "@/lib/chat";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const body: UpdateEntryDto = await req.json();

    if (!body.id) {
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: "缺少必要字段: id",
            data: null,
        });
    }

    if (body.status && !["approved", "rejected"].includes(body.status)) {
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: "无效的状态",
            data: null,
        });
    }

    if (!session.user.is_admin) {
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: "用户无权限",
            data: null,
        }, { status: 403 });
    }

    // 获取要更新的条目
    const { data: entry, error: fetchError } = await supabase
        .from("leaderboard_entries")
        .select("*")
        .eq("id", body.id)
        .single();

    // 获取对应模板
    const { data: template } = await supabase
        .from("leaderboard_templates")
        .select("*")
        .eq("id", entry.template_id)
        .single();

    if (fetchError || !entry) {
        console.error("获取排行榜条目失败:", fetchError);
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: "找不到指定的排行榜条目",
            data: null,
        });
    }

    // 更新排行榜条目
    const updateData: any = {};
    if (body.form_data !== undefined) {
        updateData.form_data = body.form_data;
    }
    if (body.score !== undefined) {
        updateData.score = body.score;
    }
    if (body.evidence_url !== undefined) {
        updateData.evidence_url = body.evidence_url;
    }
    if (body.status !== undefined) {
        updateData.status = body.status;
        // 先删除 userId, template_id, pending 下的所有数据
        await supabase
            .from("leaderboard_entries")
            .delete()
            .eq("user_id", entry.user_id)
            .eq("template_id", entry.template_id)
            .eq("status", body.status);
    }
    if (body.note !== undefined) {
        updateData.note = body.note;
    }

    const { data, error } = await supabase
        .from("leaderboard_entries")
        .update(updateData)
        .eq("id", body.id)
        .select()
        .single();

    if (error) {
        console.error("更新排行榜条目失败:", error);
        return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
            success: false,
            message: error.message,
            data: null,
        });
    }

    if (data.user_id && body.status) {

        switch (body.status) {
            case "approved":
                await sendSystemMessage(data.user_id, {
                    content:
                        `你的排行榜条目已被通过，请前往 [我的排行榜](/ranking/${template.id}) 查看`,
                });
                break;
            case "rejected":
                await sendSystemMessage(data.user_id, {
                    content:
                        `你的排行榜条目已被拒绝，拒绝理由：${body.note || "无"}`
                });
        }
    }

    return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
        success: true,
        message: "排行榜条目更新成功",
        data: {
            entry: data,
        },
    });
}
