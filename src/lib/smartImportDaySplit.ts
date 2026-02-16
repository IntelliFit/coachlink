/**
 * 智能导入：使用 LLM 将用户输入按天切分，替代 rule-based 的 splitPlanByWeekSections
 * 支持多种用户写法：Day1、周一、第1天、W1D1、第1周第1天 等
 */

import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";

export interface SplitDayItem {
    weekIndex: number;
    dayOfWeek: number;
    content: string;
}

export interface LlmSplitResult {
    days: SplitDayItem[];
    weeks: number;
}

/**
 * 使用 LLM 将训练计划文本切分为以天为单位的数组
 * 输出格式符合下游 parse-template 的输入要求（可转为 WxDx 标准化文本）
 */
export async function llmSplitPlanToDays(planText: string): Promise<LlmSplitResult> {
    const prompt = buildDaySplitPrompt(planText);

    const raw = await callDeepSeek(prompt, { maxTokens: 8000 });
    const parsed = parseJsonResponse<{
        days: Array<{ weekIndex?: number; dayOfWeek?: number; content?: string }>;
        weeks?: number;
    }>(raw);

    const rawDays = Array.isArray(parsed.days) ? parsed.days : [];
    const days: SplitDayItem[] = rawDays
        .filter((d) => d && (d.content?.trim() || d.weekIndex != null || d.dayOfWeek != null))
        .map((d, idx) => ({
            weekIndex: Math.max(1, Number(d.weekIndex) || 1),
            dayOfWeek: Math.max(1, Math.min(7, Number(d.dayOfWeek) || ((idx % 7) + 1))),
            content: String(d.content ?? "").trim(),
        }));

    let maxWeek = 1;
    for (const d of days) {
        if (d.weekIndex > maxWeek) maxWeek = d.weekIndex;
    }
    const weeks = Math.max(1, Number(parsed.weeks) || maxWeek);

    return { days, weeks };
}

/**
 * 将 LLM 切分出的按天数组，转换为按周分组的 sections 格式
 * 用于兼容现有 parse-template 的 buildParseTemplatePrompt 输入
 */
export function daysToWeekSections(days: SplitDayItem[]): Array<{ weekIndex: number; text: string }> {
    const byWeek = new Map<number, SplitDayItem[]>();
    for (const d of days) {
        const list = byWeek.get(d.weekIndex) ?? [];
        list.push(d);
        byWeek.set(d.weekIndex, list);
    }

    const sections: Array<{ weekIndex: number; text: string }> = [];
    const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b);

    for (const weekIndex of sortedWeeks) {
        const weekDays = byWeek.get(weekIndex) ?? [];
        weekDays.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

        const lines: string[] = [];
        for (const d of weekDays) {
            lines.push(`W${weekIndex}D${d.dayOfWeek}`);
            if (d.content) {
                lines.push(d.content);
            }
            lines.push("");
        }
        sections.push({
            weekIndex,
            text: lines.join("\n").trim(),
        });
    }

    if (sections.length === 0) {
        return [{ weekIndex: 1, text: "" }];
    }
    return sections;
}

function buildDaySplitPrompt(text: string): string {
    return `你是一个训练计划解析助手。请将用户输入的训练计划文本**按天切分**，输出为以天为单位的数组。用户可能使用多种写法（Day1、周一、第1天、W1D1、第1周第1天等），你需要识别并统一为标准语义下的「第几周第几天」。

## 任务
1. 识别文本中的训练日/休息日边界
2. 为每个「天」分配 weekIndex（第几周，从 1 开始）和 dayOfWeek（周内第几天，1～7）
3. 提取该天的完整内容（动作、组次、备注等）到 content

## 规则
- weekIndex、dayOfWeek 必须为 1～7 的整数；dayOfWeek 表示周一到周日
- 若用户写「Day1」「第一天」「周一」等，映射到 dayOfWeek：周一=1，周二=2，…，周日=7
- 若用户只写「Day1、Day2…」无周信息，默认 weekIndex=1；若出现「第2周」「W2」等则切换 weekIndex
- 休息日也要输出，content 可为「休息」或用户原文，type 在后续阶段区分
- **输出语言**：无论输入是中文还是英文，content 字段中的动作名、备注等文字一律用中文输出；若原文为英文请翻译为中文后填入 content，数字（组数、次数、重量、时间等）保持原样不改写。
- 同一周内 dayOfWeek 按出现顺序分配，不重复
- 若文本无法切分（如全文无日/周标记），将整段视为第 1 周第 1 天的 content

## 用户输入

"""
${text}
"""

请严格返回以下 JSON（不要其他内容）：
{
  "days": [
    {
      "weekIndex": 1,
      "dayOfWeek": 1,
      "content": "该天的完整训练内容（动作名、组次、强度、休息、备注等）"
    }
  ],
  "weeks": 1
}`;
}
