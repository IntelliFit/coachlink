import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
    GeminiParsedTemplate,
    ParseTemplateDto,
    ParseTemplateResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

/**
 * 阶段2：解析模板
 * 基于已有动作库，将训练计划文本解析为结构化的周训练模板
 */
export async function POST(req: Request) {
    const { text, actions } = await req.json() as ParseTemplateDto;

    // 检查用户登录和教练权限
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    if (!text || text.trim().length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供训练计划文本",
        }, { status: 400 });
    }

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请先完成动作解析步骤",
        }, { status: 400 });
    }

    try {
        // 构建 Prompt
        const prompt = buildParseTemplatePrompt(text, actions);

        // 调用 Gemini API
        const response = await callGemini(prompt);
        const parsedResult = parseJsonResponse<GeminiParsedTemplate>(response);

        return NextResponse.json<ApiData<ParseTemplateResponseDto>>({
            success: true,
            message: "解析模板成功",
            data: {
                weeks: parsedResult.weeks,
                trainingDays: parsedResult.trainingDays.map((day) => ({
                    ...day,
                    // 休息日可能没有 actions 数组，需要处理
                    actions: (day.actions || []).map((action) => ({
                        actionId: action.actionId,
                        sets: action.sets,
                        reps: action.reps,
                        restSeconds: action.restSeconds || 180,
                        intensityConfig: action.intensityConfig
                            ? {
                                relativeIntensity:
                                    action.intensityConfig.relativeIntensity,
                                fixedWeight: action.intensityConfig.fixedWeight,
                            }
                            : null,
                        note: action.note,
                    })),
                })),
            },
        });
    } catch (error) {
        console.error("Error parsing template:", error);
        return NextResponse.json({
            success: false,
            message: "解析模板失败，请检查文本格式",
        }, { status: 500 });
    }
}

/**
 * 构建解析模板的 Prompt
 */
function buildParseTemplatePrompt(userInput: string, actions: any[]): string {
    const actionsListStr = actions.map((a) => `- ${a.name} (ID: ${a.id})`).join(
        "\n",
    );

    return `你是一个训练计划解析助手。

任务：将以下训练计划解析为结构化的周训练模板。

可用动作库：
${actionsListStr}

强度识别规则：
- "5RM" 或 "5rm" 或 "5-6RM" → 取较小值，type: "rm"
- "70%" 或 "70%rm" 或 "80%1RM" → type: "percentage"
- "50kg" 或 "50公斤" 或 "100lbs" → type: "fixed"（使用 fixedWeight）
- 无强度描述 → intensityConfig: null

组次识别规则：
- "4*4" 或 "4x4" = 4组4次
- "3组8次" = 3组8次
- 范围如"8-12次"取较小值

休息时间规则：
- "组休4-5分钟" → 取平均值转秒（270秒）
- "组间60s" → 60秒
- 无描述 → 默认 180 秒

训练日识别：
- "W1D1" 或 "第1周第1天" → weekIndex: 1, dayOfWeek: 1
- "休息" 或 "休息日" → type: "rest"
- RPE 等信息放入 note 字段

训练计划文本：
"""
${userInput}
"""

请严格返回以下 JSON 格式（不要添加其他内容）：
{
  "weeks": 4,
  "trainingDays": [
    {
      "weekIndex": 1,
      "dayOfWeek": 1,
      "type": "training",
      "actions": [
        {
          "actionId": "匹配的动作UUID",
          "sets": 4,
          "reps": 8,
          "restSeconds": 240,
          "intensityConfig": {
            "relativeIntensity": { "type": "rm", "value": 5 }
          },
          "note": "备注信息（如 rpe9 等）"
        }
      ],
      "dayNote": "当天整体备注"
    }
  ]
}`;
}
