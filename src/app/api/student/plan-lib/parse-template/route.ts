import { NextResponse } from "next/server";
import {
    GeminiParsedTemplate,
    ParseStudentTemplateDto,
    ParseStudentTemplateResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import { splitPlanGlobalPreface } from "@/lib/planImportText";
import { findFirstLineForAction, lineHasExplicitReps, normalizeActionNameForMatch } from "@/lib/planImportText";
import { llmSplitPlanToDays, daysToWeekSections } from "@/lib/smartImportDaySplit";
import type { ItemType } from "@/types/student";

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
            // keep
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

    normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return normalized;
}

/**
 * 学员版：解析模板
 * 将训练计划文本解析为结构化的周训练模板（无教练权限检查）
 */
export async function POST(req: Request) {
    let payload: ParseStudentTemplateDto;
    try {
        const raw = await req.text();
        const cleaned = raw.replace(/^\uFEFF/, "").trim();
        payload = JSON.parse(cleaned) as ParseStudentTemplateDto;
    } catch (error) {
        console.error("student parse-template: invalid JSON body", error);
        return NextResponse.json({
            success: false,
            message: "请求体不是有效 JSON",
        }, { status: 400 });
    }

    const { text, actions } = payload;

    // 检查用户登录（任何登录用户都可以使用）
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

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请先完成动作解析步骤",
        }, { status: 400 });
    }

    // --- QUOTA CHECK START ---
    const { checkAndConsumeAiQuota } = await import("@/lib/membershipLimit");
    const quotaResult = await checkAndConsumeAiQuota(userId, 1);

    if (!quotaResult.success) {
        return NextResponse.json({
            success: false,
            message: quotaResult.message ||
                "智能生成配额不足，请升级会员或购买加油包",
        }, { status: 403 });
    }
    // --- QUOTA CHECK END ---

    try {
        // 提取“全局说明”（如热身/执行说明），并用正文做结构解析，避免说明污染解析结果
        const { globalDescription, bodyText } = splitPlanGlobalPreface(text);
        const planText = bodyText.trim() ? bodyText : text;

        // 使用 LLM 按天切分（支持 Day1、周一、W1D1、第1周 等多种写法），再转为按周 sections
        let sections: Array<{ weekIndex: number; text: string }>;
        try {
            const { days } = await llmSplitPlanToDays(planText);
            sections = daysToWeekSections(days);
        } catch (err) {
            console.warn("[student parse-template] LLM day split failed, fallback to rule-based:", err);
            sections = splitPlanByWeekSections(planText);
        }
        const allTrainingDays: any[] = [];
        let maxWeek = 0;

        const actionIndex = (actions || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            type: normalizeItemType((a as any).type),
        }));
        const actionTypeById = new Map<string, ItemType>(
            actionIndex.map((a) => [a.id, a.type]),
        );

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
                        actions: expandDietActions(
                            (day.actions || []).map((action) => {
                                const actionType =
                                    actionTypeById.get(action.actionId) || "STRENGTH";
                                const isStrength = actionType === "STRENGTH";
                                const isCardio = actionType === "CARDIO";
                                return {
                                    actionId: action.actionId,
                                    sets: isStrength ? action.sets : null,
                                    reps: isStrength ? action.reps : null,
                                    durationSeconds: isStrength
                                        ? (action as any).durationSeconds ?? null
                                        : null,
                                    restSeconds: isStrength ? (action.restSeconds || 180) : null,
                                    intensityConfig: isStrength
                                        ? (action.intensityConfig
                                            ? {
                                                relativeIntensity: action.intensityConfig
                                                    .relativeIntensity,
                                                fixedWeight:
                                                    action.intensityConfig.fixedWeight,
                                            }
                                            : null)
                                        : null,
                                    note: action.note,
                                    customData: !isStrength
                                        ? (isCardio
                                            ? normalizeCardioCustomData((action as any).customData)
                                            : ((action as any).customData ?? null))
                                        : null,
                                };
                            }),
                            actionIndex,
                        ),
                    }),
                );

                // Post-process: if the original line didn't explicitly specify reps, DO NOT guess reps.
                const actionNameById = new Map<string, string>(
                    (actions || []).map((a: any) => [a.id, a.name]),
                );
                for (const d of sectionDaysRaw) {
                    for (const a of d.actions || []) {
                        const remapResult = remapActionByHints({
                            action: a,
                            actionIndex,
                            actionNameById,
                            sectionText: section.text,
                        });
                        if (remapResult) {
                            a.actionId = remapResult.actionId;
                            if (remapResult.note !== undefined) a.note = remapResult.note;
                            if (remapResult.customData !== undefined) {
                                (a as any).customData = remapResult.customData;
                            }
                        }

                        const actionType = actionTypeById.get(a.actionId) || "STRENGTH";
                        if (actionType !== "STRENGTH") continue;
                        const actionName = actionNameById.get(a.actionId) || "";
                        const sourceLine = actionName
                            ? findFirstLineForAction(section.text, actionName)
                            : null;
                        // If we can't locate the source line (name mismatch), do not override model output.
                        // Only apply the "don't guess reps" rule when we found the line.
                        const hasReps = sourceLine ? lineHasExplicitReps(sourceLine) : null;
                        if ((a as any).durationSeconds) {
                            a.reps = null;
                        } else if (hasReps === false) {
                            a.reps = null;
                        }

                        if ((a.sets == null || a.reps == null) && sourceLine) {
                            const parsed = parseSetsRepsFromLine(sourceLine);
                            if (parsed) {
                                if (a.sets == null && parsed.sets != null) a.sets = parsed.sets;
                                if (a.reps == null && parsed.reps != null) a.reps = parsed.reps;
                            }
                        }
                    }
                }

                const sectionDays = normalizeWeekDays(
                    sectionDaysRaw,
                    section.weekIndex,
                );

                return {
                    days: sectionDays,
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

        return NextResponse.json<ApiData<ParseStudentTemplateResponseDto>>({
            success: true,
            message: "解析模板成功",
            data: {
                weeks: maxWeek || 1,
                trainingDays: allTrainingDays,
                globalDescription,
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
    const actionsListStr = actions.map((a) => {
        const attrs = Array.isArray((a as any).attrs) ? (a as any).attrs : null;
        const type = normalizeItemType((a as any).type);
        return `- ${a.name} (ID: ${a.id}, type: ${type}${attrs ? `, attrs: ${JSON.stringify(attrs)}` : ""})`;
    }).join("\n");

    return `你是一个训练计划解析助手。

任务：将以下训练计划解析为结构化的周训练模板。

可用动作库：
${actionsListStr}

动作类型规则（必须遵守）：
- 当 type=STRENGTH：输出 sets/reps/restSeconds/intensityConfig/durationSeconds
- 当 type=CARDIO/DIET/HABIT：sets/reps/restSeconds/intensityConfig 一律为 null，改为输出 customData
- customData 字段规范：
  - CARDIO: { distance(米), duration(秒), pace(字符串或数值) }
  - DIET: { content(食物清单), calories(kcal), image_url }
  - HABIT: { target_duration(分钟) }

强度识别规则（仅 STRENGTH 使用）：
- "5RM" 或 "5rm" 或 "5-6RM" → 取较小值，type: "rm"
- "70%" 或 "70%rm" 或 "80%1RM" → type: "percentage"
- "50kg" 或 "50公斤" 或 "100lbs" → type: "fixed"（使用 fixedWeight）
- 无强度描述 → intensityConfig: null

复杂逻辑降级规则（非常重要）：
- 任何无法用“组数/次数/强度/休息时间”完整表达的训练逻辑，必须降级到 note 或 dayNote，严禁胡编结构化字段
- 以下内容**一律**写入 note/dayNote（不要当成动作名，也不要拆出额外动作）：测试新极限、第一组/第二组/第X组、循环X组、同等数量、降速临界点、力竭、累积、极限个数×N、够即可、然后
- 如果出现“同等数量弹力宽拉”：动作名仍是“弹力宽拉”，reps 可以为 null；把“同等数量（参考上一动作）”写进 note
- 如果出现“第一组/第二组…循环三组”：sets 取循环次数（如3），把每组差异（第一组/第二组）写进 note
- 如果出现“累积30个/累积够即可/极限个数×N”：sets 若文本给了组数则填组数，否则可给一个合理的组数；reps 置 null，把累积目标写进 note

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

组次识别规则（仅 STRENGTH 使用）：
- "4*4" 或 "4x4" = 4组4次
- "3组8次" = 3组8次
- 范围如"8-12次"取较小值
- 如果只写了 "12RM/5RM/8RM" 但没有写明每组次数（没有 x× / 没有 “每组X个/次” / 没有 “X次”），则 reps 必须输出为 null（不要把 RM 值当成次数）

休息时间规则（仅 STRENGTH 使用）：
- "组休4-5分钟" → 取平均值转秒（270秒）
- "组间60s" → 60秒
- 无描述 → 默认 180 秒

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
          "customData": null,
          "note": "备注信息（如 rpe9 等）"
        }
      ],
      "dayNote": "当天整体备注"
    }
  ]
}`;
}

function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT") return raw;
    return "STRENGTH";
}

function remapActionByHints(params: {
    action: any;
    actionIndex: Array<{ id: string; name: string; type: ItemType }>;
    actionNameById: Map<string, string>;
    sectionText: string;
}): { actionId: string; note?: string; customData?: any } | null {
    const { action, actionIndex, actionNameById, sectionText } = params;
    const currentName = actionNameById.get(action.actionId) || "";

    const note = String(action.note ?? "");
    const autoMatch = note.match(/自动匹配[:：]\s*([^\s]+)/);
    if (autoMatch) {
        const byName = findActionByName(autoMatch[1], actionIndex);
        if (byName && byName.id !== action.actionId) {
            return { actionId: byName.id };
        }
    }

    const customData = (action as any).customData;
    if (customData && typeof customData.pace === "string") {
        const paceText = customData.pace.trim();
        if (parsePaceMinutes(paceText) === null) {
            const byName = findActionByName(paceText, actionIndex);
            if (byName && byName.id !== action.actionId) {
                return {
                    actionId: byName.id,
                    customData: { ...customData, pace: null },
                };
            }
            return {
                actionId: action.actionId,
                note: [note, paceText].filter(Boolean).join(" ").trim(),
                customData: { ...customData, pace: null },
            };
        }
    }

    if (!currentName) return null;
    const sourceLine = findFirstLineForAction(sectionText, currentName);
    if (!sourceLine) {
        const best = findBestActionInLine(sectionText, actionIndex);
        if (best && best.id !== action.actionId) {
            return { actionId: best.id };
        }
    }

    return null;
}

function findActionByName(
    name: string,
    actionIndex: Array<{ id: string; name: string; type: ItemType }>,
) {
    const target = normalizeActionNameForMatch(name);
    if (!target) return null;
    return actionIndex.find((a) => normalizeActionNameForMatch(a.name) === target) || null;
}

function findBestActionInLine(
    text: string,
    actionIndex: Array<{ id: string; name: string; type: ItemType }>,
) {
    const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let best: { id: string; score: number } | null = null;
    for (const line of lines) {
        for (const a of actionIndex) {
            if (!a.name) continue;
            if (line.includes(a.name)) {
                const score = a.name.length;
                if (!best || score > best.score) best = { id: a.id, score };
            }
        }
    }
    return best ? actionIndex.find((a) => a.id === best.id) || null : null;
}

function parseSetsRepsFromLine(line: string): { sets: number | null; reps: number | null } | null {
    const s = String(line ?? "");
    if (!s) return null;
    const repFirst = s.match(/(\d+)\s*(次|个)\s*[x×*＊]\s*(\d+)\s*组/);
    if (repFirst) {
        return { reps: Number(repFirst[1]), sets: Number(repFirst[3]) };
    }
    const setFirst = s.match(/(\d+)\s*组\s*[x×*＊]\s*(\d+)\s*(次|个)?/);
    if (setFirst) {
        return { sets: Number(setFirst[1]), reps: Number(setFirst[2]) };
    }
    return null;
}

function normalizeCardioCustomData(input: any): any {
    if (!input || typeof input !== "object") return input ?? null;
    const out = { ...input };

    if (typeof out.distance === "string") {
        const parsed = parseNumberFromText(out.distance);
        if (parsed !== null) out.distance = parsed;
    }
    if (typeof out.duration === "string") {
        const seconds = parseDurationSeconds(out.duration);
        if (seconds !== null) out.duration = seconds;
    }
    if (typeof out.pace === "string") {
        const pace = parsePaceMinutes(out.pace);
        if (pace !== null) out.pace = pace;
    }

    return out;
}

function parseNumberFromText(text: string): number | null {
    const match = String(text ?? "").match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
}

function parseDurationSeconds(text: string): number | null {
    const s = String(text ?? "");
    const minMatch = s.match(/(\d+(?:\.\d+)?)\s*分/);
    const secMatch = s.match(/(\d+(?:\.\d+)?)\s*秒/);
    const rawMin = minMatch ? Number(minMatch[1]) : null;
    const rawSec = secMatch ? Number(secMatch[1]) : null;
    if (rawMin === null && rawSec === null) return null;
    return Math.round((rawMin ?? 0) * 60 + (rawSec ?? 0));
}

function parsePaceMinutes(text: string): number | null {
    const s = String(text ?? "").trim();
    if (!s) return null;
    const mmss = s.match(/(\d+)\s*[:'’]\s*(\d{1,2})/);
    if (mmss) {
        const minutes = Number(mmss[1]);
        const seconds = Number(mmss[2]);
        if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
            return Number((minutes + seconds / 60).toFixed(2));
        }
    }
    const cnMatch = s.match(/(\d+(?:\.\d+)?)\s*分(?:\s*(\d+(?:\.\d+)?)\s*秒)?/);
    if (cnMatch) {
        const minutes = Number(cnMatch[1]);
        const seconds = cnMatch[2] ? Number(cnMatch[2]) : 0;
        if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
            return Number((minutes + seconds / 60).toFixed(2));
        }
    }
    const asNumber = Number(s);
    return Number.isFinite(asNumber) ? asNumber : null;
}

function expandDietActions(
    actions: any[],
    actionIndex: Array<{ id: string; name: string; type: ItemType }>,
): any[] {
    return (actions || []).flatMap((action) => {
        const actionType = actionIndex.find((a) => a.id === action.actionId)?.type;
        if (actionType !== "DIET") return [action];
        const content = action.customData?.content;
        if (!content || typeof content !== "string") return [action];
        const parts = splitDietContent(content);
        if (parts.length <= 1) return [action];
        return parts.map((part) => {
            const { name, amount } = splitFoodNameAndAmount(part);
            const matched = findDietActionByFragment(name, actionIndex);
            return {
                ...action,
                actionId: matched?.id ?? action.actionId,
                customData: {
                    ...action.customData,
                    content: amount || part.trim(),
                },
            };
        });
    });
}

function splitDietContent(content: string): string[] {
    const cleaned = String(content ?? "").trim();
    if (!cleaned) return [];
    let parts = cleaned.split(/[+＋]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1 && cleaned.includes("、")) {
        parts = cleaned.split("、").map((p) => p.trim()).filter(Boolean);
    }
    return parts;
}

function splitFoodNameAndAmount(part: string): { name: string; amount: string } {
    const cleaned = String(part ?? "").trim().replace(/^(早餐|午餐|晚餐|加餐|宵夜)[:：]?\s*/g, "");
    const match = cleaned.match(/(\d+(?:\.\d+)?\s*(?:g|kg|克|公斤|毫升|ml|mL|L|l|片|个|杯|勺|斤|汤匙|大勺|小勺).*)/i);
    if (match && match.index !== undefined) {
        const name = cleaned.slice(0, match.index).trim();
        const amount = cleaned.slice(match.index).trim();
        return { name: name || cleaned, amount };
    }
    return { name: cleaned, amount: "" };
}

function findDietActionByFragment(
    fragment: string,
    actionIndex: Array<{ id: string; name: string; type: ItemType }>,
) {
    const normalized = normalizeFoodNameForMatch(fragment);
    if (!normalized) return null;
    return actionIndex.find((a) => normalizeFoodNameForMatch(a.name) === normalized) || null;
}

function normalizeFoodNameForMatch(input: string): string {
    let s = String(input ?? "").trim();
    if (!s) return "";
    s = s.replace(/[（(][^）)]*[）)]/g, "");
    s = s.replace(/约/g, "");
    s = s.replace(/\d+(?:\.\d+)?\s*(?:g|kg|克|公斤|毫升|ml|mL|L|l|片|个|杯|勺|斤|汤匙|大勺|小勺)/gi, "");
    return normalizeActionNameForMatch(s);
}
