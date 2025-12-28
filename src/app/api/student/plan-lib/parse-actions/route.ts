import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
    GeminiParsedAction,
    ParsedStudentActionInfo,
    ParseStudentActionsDto,
    ParseStudentActionsResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

/**
 * 学员版：解析动作
 * 从用户粘贴的训练计划文本中提取动作列表，并与学员动作库进行匹配
 */
export async function POST(req: Request) {
    const { text } = await req.json() as ParseStudentActionsDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!text || text.trim().length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供训练计划文本",
        }, { status: 400 });
    }

    try {
        // 获取当前学员的所有动作
        const { data: existingActions, error: actionsError } =
            await serviceRoleSupabase
                .from("student_actions")
                .select("*")
                .eq("user_id", userId);

        if (actionsError) {
            console.error("Error fetching student actions:", actionsError);
            return NextResponse.json({
                success: false,
                message: "获取动作库失败",
            }, { status: 500 });
        }

        // 构建 Prompt
        const prompt = buildParseActionsPrompt(text, existingActions || []);

        // 调用 Gemini API
        const response = await callGemini(prompt);
        const parsedResult = parseJsonResponse<
            { actions: GeminiParsedAction[] }
        >(response);

        // 处理解析结果，标记是否为新动作
        const actions: ParsedStudentActionInfo[] = parsedResult.actions.map(
            (action) => ({
                ...action,
                isNew: !action.matchedExistingId,
            }),
        );

        return NextResponse.json<ApiData<ParseStudentActionsResponseDto>>({
            success: true,
            message: "解析动作成功",
            data: {
                actions,
            },
        });
    } catch (error) {
        console.error("Error parsing student actions:", error);
        return NextResponse.json({
            success: false,
            message: "解析动作失败，请检查文本格式",
        }, { status: 500 });
    }
}

/**
 * 构建解析动作的 Prompt（学员版）
 */
function buildParseActionsPrompt(
    userInput: string,
    existingActions: any[],
): string {
    const actionsListStr = existingActions.length > 0
        ? existingActions.map((a) => `- ${a.name} (ID: ${a.id})`).join("\n")
        : "(暂无已有动作)";

    return `你是一个训练计划解析助手。

任务：从以下训练计划中提取所有独立的训练动作名称。

已有动作库：
${actionsListStr}

解析规则：
1. 提取每个不同的动作名称（去重）
2. 识别动作是否需要"自动计算重量"功能（基于是否有RM、百分比等强度描述）
3. 判断动作是否"包含自重"（如引体向上、臂屈伸、俯卧撑、悬挂等自重动作应为 true）
4. 如果动作在已有动作库中存在（名称相似即可），记录匹配ID
5. 确定动作的属性：通常包含 "组数", "次数", "强度", "休息时间"

训练计划文本：
"""
${userInput}
"""

请严格返回以下 JSON 格式（不要添加其他内容）：
{
  "actions": [
    {
      "name": "动作名称",
      "matchedExistingId": "uuid 或 null",
      "needsAutoCompute": true,
      "includesBodyWeight": false,
      "attrs": ["组数", "次数", "强度", "休息时间"]
    }
  ]
}`;
}
