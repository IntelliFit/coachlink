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
 * 简单的中文数字转数字（支持到二十内，满足周数场景）
 */
function parseChineseNum(input: string): number | null {
    const map: Record<string, number> = {
        "零": 0,
        "一": 1,
        "二": 2,
        "两": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
    };
    if (/^\d+$/.test(input)) return parseInt(input, 10);
    if (input === "十") return 10;
    if (input.startsWith("十")) {
        const last = map[input.slice(1)] ?? 0;
        return 10 + last;
    }
    if (input.endsWith("十")) {
        const first = map[input[0]] ?? 0;
        return first * 10;
    }
    if (input.includes("十")) {
        const [a, b] = input.split("十");
        const first = map[a] ?? 0;
        const last = map[b] ?? 0;
        return first * 10 + last;
    }
    return map[input] ?? null;
}

/**
 * 将长文本按周拆分，支持 W#D# 以及“第X周/第一周/第二周”中文标题
 */
function splitPlanByWeekSections(text: string): Array<{
    weekIndex: number;
    text: string;
}> {
    const lines = text.split("\n");
    const sections: Array<{ weekIndex: number; text: string }> = [];
    let currentWeek = 1;
    let buffer: string[] = [];

    const flush = () => {
        const joined = buffer.join("\n").trim();
        if (joined) sections.push({ weekIndex: currentWeek, text: joined });
        buffer = [];
    };

    for (const raw of lines) {
        const line = raw;

        const wMatch = line.match(/W(\d+)D/i);
        const chineseWeekMatch = line.match(
            /第\s*([0-9一二三四五六七八九十两]+)\s*周/,
        );

        if (chineseWeekMatch) {
            const num = parseChineseNum(chineseWeekMatch[1]);
            if (num) {
                flush();
                currentWeek = num;
                buffer.push(line);
                continue;
            }
        }

        if (wMatch) {
            const num = parseInt(wMatch[1], 10);
            flush();
            currentWeek = num;
            buffer.push(line);
            continue;
        }

        buffer.push(line);
    }

    flush();

    if (sections.length === 0) {
        return [{ weekIndex: 1, text: text.trim() }];
    }

    // 合并同周的内容（防止多次切换同一周导致分片）
    const merged: Record<number, string[]> = {};
    for (const sec of sections) {
        merged[sec.weekIndex] = merged[sec.weekIndex] || [];
        merged[sec.weekIndex].push(sec.text);
    }
    return Object.entries(merged)
        .map(([wk, arr]) => ({ weekIndex: Number(wk), text: arr.join("\n\n") }))
        .sort((a, b) => a.weekIndex - b.weekIndex);
}

/**
 * 周内顺序重排：按出现顺序编号 dayOfWeek=1..n，并在该周内补齐到 7 天
 */
function normalizeWeekDays(days: any[], weekIndex: number) {
    // 按出现顺序
    const sorted = [...days].sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0));
    const used = new Set<number>();
    const normalized: any[] = [];

    // 先尊重模型给出的 dayOfWeek（1-7 且未重复），否则按顺序分配下一个可用 dayOfWeek
    let nextDay = 1;
    for (const d of sorted) {
        let dayOfWeek = typeof d.dayOfWeek === "number" ? d.dayOfWeek : null;
        if (
            dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 7 &&
            !used.has(dayOfWeek)
        ) {
            // keep as is
        } else {
            while (used.has(nextDay) && nextDay <= 7) nextDay++;
            dayOfWeek = nextDay;
        }
        used.add(dayOfWeek);
        normalized.push({
            ...d,
            weekIndex,
            dayOfWeek,
            _idx: undefined,
        });
        while (used.has(nextDay) && nextDay <= 7) nextDay++;
    }

    // 补齐未占用的 dayOfWeek 到 7
    for (let dow = 1; dow <= 7; dow++) {
        if (!used.has(dow)) {
            normalized.push({
                weekIndex,
                dayOfWeek: dow,
                type: "rest",
                actions: [],
                dayNote: "自动填充休息日",
            });
        }
    }

    // 再按 dayOfWeek 排序
    normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return normalized;
}

/**
 * 阶段2：解析模板
 * 基于已有动作库，将训练计划文本解析为结构化的周训练模板
 */
export async function POST(req: Request) {
    let payload: ParseTemplateDto;
    try {
        payload = await req.json() as ParseTemplateDto;
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "请求体不是有效 JSON",
        }, { status: 400 });
    }

    const { text, actions } = payload;

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

        const parsedSections = await Promise.all(
            sections.map(async (section) => {
                const prompt = buildParseTemplatePrompt(
                    section.text,
                    actions,
                    section.weekIndex,
                );

                const response = await callDeepSeek(prompt, {
                    maxTokens: 3500,
                });
                const parsedResult = parseJsonResponse<GeminiParsedTemplate>(
                    response,
                    `parse-template-week-${section.weekIndex}`,
                );

                const sectionDaysRaw = (parsedResult.trainingDays || []).map(
                    (day, idx) => ({
                        ...day,
                        _idx: idx, // 仅用于周内排序
                        weekIndex: section.weekIndex,
                        actions: (day.actions || []).map((action) => {
                            // 处理 AI 输出的强度配置 - 支持多种格式
                            let processedIntensityConfig: any = null;

                            if (action.intensityConfig) {
                                const ic = action.intensityConfig;

                                // 情况1: AI 输出 { type: "fixed", fixedWeight: 127.5 }
                                if (
                                    (ic as any).type === "fixed" &&
                                    (ic as any).fixedWeight
                                ) {
                                    processedIntensityConfig = {
                                        fixedWeight: {
                                            value: (ic as any).fixedWeight,
                                            unit: "kg",
                                        },
                                    };
                                } // 情况2: AI 输出 { type: "rm", value: 5 } 或 { relativeIntensity: { type, value } }
                                else if (
                                    (ic as any).type === "rm" ||
                                    (ic as any).type === "percentage"
                                ) {
                                    processedIntensityConfig = {
                                        relativeIntensity: {
                                            type: (ic as any).type,
                                            value: (ic as any).value,
                                        },
                                    };
                                } // 情况3: 已经是正确的嵌套格式 { relativeIntensity: {...} } 或 { fixedWeight: {...} }
                                else if (
                                    ic.relativeIntensity ||
                                    (ic as any).fixedWeight
                                ) {
                                    processedIntensityConfig = {
                                        relativeIntensity: ic.relativeIntensity,
                                        fixedWeight: (ic as any).fixedWeight,
                                    };
                                }
                            }

                            return {
                                actionId: action.actionId,
                                sets: action.sets,
                                reps: action.reps,
                                restSeconds: action.restSeconds || 180,
                                intensityConfig: processedIntensityConfig,
                                note: action.note,
                            };
                        }),
                    }),
                );

                const normalizedDays = normalizeWeekDays(
                    sectionDaysRaw,
                    section.weekIndex,
                );

                return {
                    days: normalizedDays,
                    weeks: parsedResult.weeks || section.weekIndex,
                    weekIndex: section.weekIndex,
                };
            }),
        );

        // 按周顺序拼接，保持每周内部编号和长度
        parsedSections.sort((a, b) => a.weekIndex - b.weekIndex);
        for (const chunk of parsedSections) {
            allTrainingDays.push(...chunk.days);
            maxWeek = Math.max(maxWeek, chunk.weeks, chunk.weekIndex);
        }

        return NextResponse.json<ApiData<ParseTemplateResponseDto>>({
            success: true,
            message: "解析模板成功",
            data: {
                weeks: maxWeek || 1,
                trainingDays: allTrainingDays,
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

强度识别规则（按优先级从高到低）：
- **最高优先级：绝对重量** - 当同时出现绝对重量和百分比时（如 "112.5kg (75%)" 或 "@ 127.5kg (85%)"），优先使用绝对重量：type: "fixed", fixedWeight: 112.5
- "50kg" 或 "50公斤" 或 "100lbs" 或 "@XXXkg" → type: "fixed"（使用 fixedWeight: 数值）
- "5RM" 或 "5rm" 或 "5-6RM" → 取较小值，type: "rm", value: 5
- "70%" 或 "70%rm" 或 "80%1RM" → type: "percentage", value: 70
- 无强度描述 → intensityConfig: null

动作必填规则：
- 每个 training day 必须至少有 1 个动作，禁止留空；如果未能匹配到动作，请从可用动作库中选择名称最相近的动作填充 actionId，并在 note 标注“自动匹配”
- 不要把动作全部挪到 dayNote；动作数据必须体现在 actions 数组

星期/周几映射规则（务必使用正确的 dayOfWeek）：
- 发现“周一/星期一/礼拜一/Mon/周1”等词 → dayOfWeek=1；周二=2；周三=3；周四=4；周五=5；周六=6；周日/周天=7
- 如果同一天内有多个训练安排，按出现顺序放入同一个 dayOfWeek 的 actions 数组
- 如果出现“周一/周四”只对应两个训练日，则这两天必须落在 dayOfWeek=1 和 dayOfWeek=4；缺口用 rest 补齐

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
- 如果没有明确的周标题，请按出现顺序分周：每 7 天为一周，不足 7 天的最后一周用 rest 补齐
- 如果出现“第X周”“第X-Y周”“第 X - Y 周”或“第一阶段（第1-2周）”之类的描述，请据此推断周号范围：将后续天数按顺序分配到这些周；缺少的天数用 rest 填满；超出的天数继续滚到后续周
- 如果没有任何周线索但出现“周一/周二/…”字样，则这些天按照出现顺序映射为 dayOfWeek=1..7，超过 7 天滚到下一周；缺失的天用 rest 补齐
- 如果文本说明“本周 X 练”或“每周训练 X 天/练X休Y”，则该周训练日上限为 X，缺口补 rest，超过 X 的训练日仍保留但 dayOfWeek 继续顺延（保证不丢失信息）

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
- 仅解析并输出 weekIndex = ${
        fixedWeekIndex ?? "原文中的周序"
    } 的训练日；不要返回其他周

训练计划文本：
"""
${userInput}
"""

请严格返回以下 JSON 格式（不要添加其他内容）。

【示例1】同时有百分比和绝对重量："卧推 5×5 @ 112.5kg (75%)"：
{
  "actionId": "xxx",
  "sets": 5,
  "reps": 5,
  "restSeconds": 180,
  "intensityConfig": {
    "relativeIntensity": { "type": "percentage", "value": 75 },
    "fixedWeight": 112.5
  },
  "note": ""
}

【示例2】只有RM值："负重引体 4×4 @ 5RM rpe9 组休60s"：
{
  "actionId": "xxx",
  "sets": 4,
  "reps": 4,
  "restSeconds": 60,
  "intensityConfig": {
    "relativeIntensity": { "type": "rm", "value": 5 }
  },
  "note": "rpe9"
}

【示例3】只有绝对重量："深蹲 3×8 @ 100kg"：
{
  "actionId": "xxx",
  "sets": 3,
  "reps": 8,
  "restSeconds": 180,
  "intensityConfig": {
    "fixedWeight": 100
  },
  "note": ""
}

【示例4】只有百分比："硬拉 4×5 @ 80%1RM"：
{
  "actionId": "xxx",
  "sets": 4,
  "reps": 5,
  "restSeconds": 180,
  "intensityConfig": {
    "relativeIntensity": { "type": "percentage", "value": 80 }
  },
  "note": ""
}

【示例5】无强度信息："杠铃划船 4×10"：
{
  "actionId": "xxx",
  "sets": 4,
  "reps": 10,
  "restSeconds": 180,
  "intensityConfig": null,
  "note": ""
}

完整返回格式：
{
  "weeks": 4,
  "trainingDays": [
    {
      "weekIndex": 1,
      "dayOfWeek": 1,
      "type": "training",
      "actions": [ /* 动作数组，格式见上方示例 */ ],
      "dayNote": "当天整体备注"
    }
  ]
}`;
}
