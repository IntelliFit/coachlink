import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { RenameImpromptuDto, RenameImpromptuResponseDto } from "./entity";
import { normalizeImpromptuTitle } from "@coachlink/core/src/impromptuTitle";

const fail = (message: string, status: number) =>
    NextResponse.json<ApiData<RenameImpromptuResponseDto>>({
        success: false,
        message,
        data: null,
    }, { status });

export async function POST(req: Request) {
    try {
        const userId = await getApiUserId(req);
        if (!userId) return fail("用户未登录", 401);

        const body = await req.json().catch(() => null) as RenameImpromptuDto | null;
        const executionId = typeof body?.executionId === "string" ? body.executionId.trim() : "";
        if (!executionId) return fail("缺少执行ID", 400);

        const normalized = normalizeImpromptuTitle(body?.title);
        if (!normalized.ok) return fail(normalized.message, 400);

        const { data: execution, error: queryError } = await supabase
            .from("impromptu_executions")
            .select("id, student_id")
            .eq("id", executionId)
            .single();

        if (queryError || !execution) return fail("训练记录不存在", 404);
        if (execution.student_id !== userId) return fail("无权限", 403);

        const { data: updated, error: updateError } = await supabase
            .from("impromptu_executions")
            .update({ title: normalized.title })
            .eq("id", executionId)
            .eq("student_id", userId)
            .select("id, title")
            .single();

        if (updateError || !updated) {
            console.error("rename impromptu error:", updateError);
            const missingColumn = updateError?.code === "42703" || updateError?.code === "PGRST204";
            return fail(missingColumn ? "训练改名功能尚未开放" : "保存训练名称失败", missingColumn ? 503 : 500);
        }

        return NextResponse.json<ApiData<RenameImpromptuResponseDto>>({
            success: true,
            message: "已保存训练名称",
            data: { id: updated.id, title: updated.title ?? null },
        });
    } catch (error) {
        console.error("rename impromptu error:", error);
        return fail("服务器错误", 500);
    }
}
