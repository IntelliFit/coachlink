import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    isSmartImportTraceEnabled,
    sanitizeTraceId,
    tryTrace,
    writeTraceJson,
    writeTraceText,
} from "@/lib/smartImportTrace";

type FinalizeTraceDto = {
    traceId: string;
    uiSnapshot: unknown;
};

function buildCaseMarkdown(traceId: string): string {
    return [
        `## Smart Import Trace Case`,
        ``,
        `- traceId: \`${traceId}\``,
        ``,
        `### 背景（自动生成后请补充）`,
        ``,
        `- 私有动作库已有/缺失：`,
        `- 预期匹配策略：仅私有库匹配；变式优先/否则回退；注释进入 note/dayNote`,
        ``,
        `### 关键期望（可按需要补充断言）`,
        ``,
        `- 注释/执行要点不丢（进入 action.note 或 dayNote）`,
        `- 休息日占位（自然日 dayIndex）`,
        `- 缺失信息留空（null/自选），不瞎猜`,
        ``,
        `### 我的评论（TODO）`,
        ``,
        `- `,
        ``,
    ].join("\n");
}

export async function POST(req: Request) {
    const traceEnabled = isSmartImportTraceEnabled();

    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Unauthorized",
            data: null,
        }, { status: 401 });
    }
    if (!session.user.is_coach) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Forbidden",
            data: null,
        }, { status: 403 });
    }

    let payload: FinalizeTraceDto;
    try {
        payload = await req.json() as FinalizeTraceDto;
    } catch {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "请求体不是有效 JSON",
            data: null,
        }, { status: 400 });
    }

    const traceId = sanitizeTraceId(payload.traceId);
    if (!traceId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "traceId 无效",
            data: null,
        }, { status: 400 });
    }

    await tryTrace(traceEnabled, traceId, async (id) => {
        await writeTraceJson(id, "ui.snapshot.json", payload.uiSnapshot);
        await writeTraceText(id, "case.md", buildCaseMarkdown(id));
    });

    return NextResponse.json<ApiData<{ caseDir: string }>>({
        success: true,
        message: traceEnabled ? "已保存用例留痕" : "留痕未启用（已忽略）",
        data: {
            caseDir: `docs/智能导入计划/cases-generated/${traceId}`,
        },
    });
}

