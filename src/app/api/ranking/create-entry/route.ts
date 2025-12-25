import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { CreateEntryDto, CreateEntryResponseDto } from "./entity";
import { randomUUID } from "crypto";
import { LeaderboardFormInput } from "@/types/leaderboard";
import fs from "fs";
import path from "path";

function logDebug(message: string, data?: any) {
    try {
        const timestamp = new Date().toISOString();
        const logPath = path.join(process.cwd(), "debug_log.txt");
        const content = `\n[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ""
            }\n-------------------`;
        fs.appendFileSync(logPath, content);
    } catch (e) {
        console.error("LOGGING FAILED", e);
    }
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<CreateEntryResponseDto>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const body: CreateEntryDto = await req.json();

    if (!body.template_id) {
        return NextResponse.json({
            success: false,
            message: "缺少 template_id",
            data: null,
        });
    }

    const userId = session.user.id;

    // 先删除 userId, template_id, pending 下的所有数据
    await supabase
        .from("leaderboard_entries")
        .delete()
        .eq("user_id", userId)
        .eq("template_id", body.template_id)
        .eq('status', 'pending');

    const { data: template } = await supabase
        .from("leaderboard_templates")
        .select("*")
        .eq("id", body.template_id)
        .maybeSingle();

    if (template && !body.score) {
        const targetItem = (body.form_data as LeaderboardFormInput[]).find(
            (item) => item.name === template.rank_by_field,
        );
        if (targetItem) {
            body.score = targetItem.userInput as number;
        }
    }

    const { data, error } = await supabase
        .from("leaderboard_entries")
        .insert({
            template_id: body.template_id,
            form_data: body.form_data,
            score: body.score,
            evidence_url: body.evidence_url,
            status: "pending",
            user_id: userId,
        })
        .select()
        .single();

    if (error) {
        console.error("操作排行榜条目失败:", error);
        logDebug("Supabase Error", error);
        return NextResponse.json<ApiData<CreateEntryResponseDto>>({
            success: false,
            message: error.message,
            data: null,
        });
    }

    return NextResponse.json<ApiData<CreateEntryResponseDto>>({
        success: true,
        message: "排行榜条目创建成功",
        data: { entry: data },
    });
}
