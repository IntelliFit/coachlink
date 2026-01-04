import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
    GeminiParsedTemplate,
    ParseTemplateDto,
    ParseTemplateResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";

/**
 * 将长文本按周拆分，降低大模型输出长度，避免截断
 */
function splitPlanByWeekSections(text: string): Array<{
    weekIndex: number;
    text: string;
}> {
    const regex = /(^|\n)#+\s*W(\d+)D\d+/g;
    const matches: Array<{ weekIndex: number; start: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const weekIndex = parseInt(match[2], 10);
        matches.push({ weekIndex, start: match.index });
    }

    if (matches.length === 0) {
        return [{ weekIndex: 1, text: text.trim() }];
    }

    // 将同一周的所有日程合并为一个片段
    const sections: Array<{ weekIndex: number; text: string }> = [];
    let currentWeek = matches[0].weekIndex;
    let currentStart = matches[0].start;

    for (let i = 1; i < matches.length; i++) {
        const { weekIndex, start } = matches[i];
        if (weekIndex !== currentWeek) {
            const slice = text.slice(currentStart, start).trim();
            if (slice) sections.push({ weekIndex: currentWeek, text: slice });
            currentWeek = weekIndex;
            currentStart = start;
        }
    }
    const finalSlice = text.slice(currentStart).trim();
    if (finalSlice) sections.push({ weekIndex: currentWeek, text: finalSlice });

    return sections;
}

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
        // 按周拆分，逐段解析，减少截断风险并加速
        const sections = splitPlanByWeekSections(text);
        const allTrainingDays: any[] = [];
        let maxWeek = 0;

        let globalIdx = 0;

        const parsedSections = await Promise.all(sections.map(async (section) => {
            const prompt = buildParseTemplatePrompt(
                section.text,
                actions,
                section.weekIndex,
            );

            const response = await callDeepSeek(prompt, { maxTokens: 3500 });
            const parsedResult = parseJsonResponse<GeminiParsedTemplate>(
                response,
                `parse-template-week-${section.weekIndex}`,
            );

            const sectionDaysRaw = (parsedResult.trainingDays || []).map(
                (day, idx) => ({
                    ...day,
                    _idx: globalIdx++,
                    weekIndex: section.weekIndex,
                    actions: (day.actions || []).map((action) => ({
                        actionId: action.actionId,
                        sets: action.sets,
                        reps: action.reps,
                        restSeconds: action.restSeconds || 180,
                        intensityConfig: action.intensityConfig
                            ? {
                                relativeIntensity: action.intensityConfig.relativeIntensity,
                                fixedWeight: action.intensityConfig.fixedWeight,
                            }
                            : null,
                        note: action.note,
                    })),
                }),
            );

            return {
                days: sectionDaysRaw,
                weeks: parsedResult.weeks || section.weekIndex,
            };
        }));

        for (const chunk of parsedSections) {
            allTrainingDays.push(...chunk.days);
            maxWeek = Math.max(maxWeek, chunk.weeks);
        }

        // 全局按出现顺序重新编号 dayOfWeek，跨天累进；必要时补足到周末
        allTrainingDays.sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0));

        const reassigned: any[] = [];
        let dayCounter = 1;
        for (const day of allTrainingDays) {
            const weekIndex = Math.floor((dayCounter - 1) / 7) + 1;
            const dayOfWeek = ((dayCounter - 1) % 7) + 1;
            reassigned.push({
                ...day,
                weekIndex,
                dayOfWeek,
                _idx: undefined,
            });
            dayCounter += 1;
        }

        // 补齐到最近的周末
        const remainder = (dayCounter - 1) % 7;
        if (remainder !== 0) {
            const pad = 7 - remainder;
            const currentWeek = Math.floor((dayCounter - 1) / 7) + 1;
            for (let i = 0; i < pad; i++) {
                const dayOfWeek = remainder + i + 1;
                reassigned.push({
                    weekIndex: currentWeek,
                    dayOfWeek,
                    type: "rest",
                    actions: [],
                    dayNote: "自动填充休息日",
                });
            }
        }

        const totalWeeks = Math.max(
            Math.ceil(reassigned.length / 7),
            maxWeek,
        );

        return NextResponse.json<ApiData<ParseTemplateResponseDto>>({
            success: true,
            message: "解析模板成功",
            data: {
                weeks: totalWeeks || 1,
                trainingDays: reassigned,
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
function buildParseTemplatePrompt(
    userInput: string,
    actions: any[],
    fixedWeekIndex?: number,
): string {
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

休息日识别与保留规则：
- 任何包含“休息”字样的行（如“休息1天 拉伸 松解 低强度有氧 ……”）都必须生成一个独立的天，type: "rest"
- 休息日也占用 dayOfWeek，请按照输入出现的顺序顺延 dayOfWeek，绝不能跳过或与训练日合并
- 将该行的文本保留到 dayNote，切勿丢弃或合并到前一天的 note
- 如果未明确写休息，但出现“每周训练X天/练X休X/一周X练X休”等描述，请自动推断休息日：
  - 同一周内 dayOfWeek 需连续递增直至该周结束，训练日缺口一律补充 type: "rest"
  - 优先在训练日之间插入休息；若仍不足，补在该周末尾
  - 将推断来源写入 dayNote（如 “系统推断休息日：每周训练3天”）

顺序与周次规则：
- 严格按输入顺序输出 trainingDays，不要重排
- 当遇到新的 "W#D#" 标题时切换周/日；如果标题缺失但出现休息行，则 dayOfWeek = 上一次 dayOfWeek + 1，weekIndex 沿用当前周
- weeks 取输入中出现的最大周序号（例：出现 W1/W2 → weeks = 2）

组次识别规则：
- "4*4" 或 "4x4" = 4组4次
- "3组8次" = 3组8次
- 范围如"8-12次"取较小值

休息时间规则：
- "组休4-5分钟" → 取平均值4.5分钟
- "组间1分钟" → 1分钟
- 无描述 → 默认3分钟

训练日识别：
- "W1D1" 或 "第1周第1天" → weekIndex: 1, dayOfWeek: 1
- "休息" 或 "休息日" → type: "rest"
- RPE 等信息放入 note 字段

输出范围限制：
- 仅解析并输出 weekIndex = ${fixedWeekIndex ?? "原文中的周序"} 的训练日；不要返回其他周

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
