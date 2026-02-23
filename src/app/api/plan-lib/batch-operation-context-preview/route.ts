/**
 * 上下文预览 API：返回“本次请求下”会注入给 AI 的完整上下文文本及启用/不可用项，不调用 AI、不执行修改。
 * 用于调试与测试：确认默认/额外配置的上下文分别包含哪些内容。
 *
 * POST body 与 batch-operation 一致（仅用其中与上下文相关的字段）：
 * - targetActionType?: 'coach' | 'student'
 * - templateId?: string
 * - contextOptions?: { subscriptionId?, includeStudentProfile?, ... }
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { buildBatchOperationContext } from "../batch-operation/context";
import type { ApiData } from "@/types/api";
import type { BatchOperationContextOptions } from "../batch-operation/entity";

export interface ContextPreviewDto {
    targetActionType?: "coach" | "student";
    templateId?: string;
    contextOptions?: BatchOperationContextOptions;
}

export interface ContextPreviewResponseDto {
    /** 本次会注入给 AI 的完整“额外上下文”文本（与 batch-operation 中一致） */
    prompt: string;
    /** 已成功加载并加入 prompt 的上下文项（中文标签） */
    enabled: string[];
    /** 请求了但因无数据/无权限而未加入的项 */
    unavailable: string[];
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<ContextPreviewResponseDto>>(
            { success: false, message: "未登录", data: null },
            { status: 401 }
        );
    }

    const body = (await req.json()) as ContextPreviewDto;
    const targetActionType = body.targetActionType ?? "coach";
    if (targetActionType === "coach" && !session.user.is_coach) {
        return NextResponse.json<ApiData<ContextPreviewResponseDto>>(
            { success: false, message: "仅教练可预览教练端上下文", data: null },
            { status: 403 }
        );
    }

    const result = await buildBatchOperationContext({
        userId: session.user.id,
        targetActionType,
        templateId: body.templateId,
        contextOptions: body.contextOptions,
        supabase,
    });

    return NextResponse.json<ApiData<ContextPreviewResponseDto>>({
        success: true,
        message: "ok",
        data: {
            prompt: result.prompt,
            enabled: result.enabled,
            unavailable: result.unavailable,
        },
    });
}
