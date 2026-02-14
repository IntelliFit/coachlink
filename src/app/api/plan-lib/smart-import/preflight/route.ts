import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";
import type { PreflightDto, PreflightResponseDto } from "./entity";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";

/**
 * Stage0：智能导入前置完备性检测
 * 在 parse-actions 之前调用，判断用户输入是否包含完整、清晰的可解析信息
 * 教练和学员均可使用（仅需登录）
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    let text: string;
    try {
        const body = await req.json() as PreflightDto;
        text = body?.text ?? "";
    } catch {
        return NextResponse.json({
            success: false,
            message: "请求体格式错误",
            data: null,
        }, { status: 400 });
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供训练计划文本",
            data: null,
        }, { status: 400 });
    }

    const prompt = buildPreflightPrompt(text.trim());

    try {
        const raw = await callDeepSeek(prompt, { maxTokens: 1200 });
        const result = parseJsonResponse<{
            isComplete: boolean;
            canProceed: boolean;
            missing?: Array<{
                scope?: string;
                where?: string;
                field?: string;
                reason?: string;
                exampleFix?: string;
            }>;
            userMessage?: string;
        }>(raw);

        const isComplete = Boolean(result.isComplete);
        const canProceed = result.canProceed !== false && isComplete;
        const missing = Array.isArray(result.missing)
            ? result.missing
                .filter((m) => m && (m.reason || m.exampleFix || m.field))
                .map((m) => ({
                    scope: (m.scope === "global" || m.scope === "day" || m.scope === "action"
                        ? m.scope
                        : "global") as "global" | "day" | "action",
                    where: m.where ?? undefined,
                    field: m.field ?? undefined,
                    reason: m.reason ?? undefined,
                    exampleFix: m.exampleFix ?? undefined,
                }))
            : [];
        const userMessage = typeof result.userMessage === "string" && result.userMessage.trim()
            ? result.userMessage.trim()
            : (isComplete
                ? "信息完整，可以继续解析"
                : "请根据下方提示补充或完善训练计划内容后再试");

        return NextResponse.json<ApiData<PreflightResponseDto>>({
            success: true,
            message: "预检完成",
            data: {
                isComplete,
                canProceed,
                missing,
                userMessage,
            },
        });
    } catch (err) {
        console.error("[preflight] LLM call failed:", err);
        // 预检失败时不阻断流程：允许继续尝试解析
        return NextResponse.json<ApiData<PreflightResponseDto>>({
            success: true,
            message: "预检跳过（服务暂不可用）",
            data: {
                isComplete: true,
                canProceed: true,
                missing: [],
                userMessage: "预检服务暂不可用，将直接尝试解析",
            },
        });
    }
}

function buildPreflightPrompt(text: string): string {
    return `你是一个训练计划导入助手。请判断用户粘贴的文本是否**信息完整**、**足以被解析成结构化训练计划**。

## 判断规则（以下情况视为信息不完整，返回 isComplete: false）

### 1. 缺少训练日/周结构
- 无法识别哪些是「第几周」「第几天」的内容（如缺少 W1/W2、第1周、Day1、周一、D1 等标记）→ 不完整
- 全文只有一堆动作名和数字，无法区分每天分别练什么 → 不完整

### 2. 动作边界或参数模糊
- 出现「做几组」「若干次」「适量」等模糊表述，无法推断具体组数/次数 → 不完整
- 动作名与强度/组次黏在一起无法拆分（如「负重引体5RM」若上下文无其他信息则尚可；若大量混排无法区分则视为不完整）

### 3. 信息过于简略
- 全文少于 20 字且无法推断出至少 1 个完整训练日（动作+组次）→ 不完整
- 只有标题（如「第1周」「周一」）没有任何具体动作内容 → 不完整

## 若信息完整（以下情况返回 isComplete: true，canProceed: true）
- 能识别出至少 1 个训练日，且该日有具体动作及组数/次数/强度等（可部分缺失，系统支持后续补全）
- 使用了 W1D1、第1周、Day1、周一、第一天等任意一种可理解的日/周标记
- 动作名可识别，组次可用数字或中文数字（如 3组8次、五组）表达

**关键**：只要文本能让人理解「哪天练什么、大概几组几次」，即视为可解析，**不要**过度苛求格式完美。用户可能用 Day1、周一、第1天等多种写法，只要存在可推断的结构即可。

## 用户输入的文本

"""
${text}
"""

请严格返回以下 JSON（不要其他内容）：
{
  "isComplete": true 或 false,
  "canProceed": true 或 false,
  "missing": [
    {
      "scope": "global 或 day 或 action",
      "where": "如 W1D1、第1周、某行片段",
      "field": "如 dayMarkers、actionBoundaries、sets、reps",
      "reason": "为什么缺/为什么不完整",
      "exampleFix": "给用户的示例补写方式，如：建议在每训练日前加「W1D1」「第1周第1天」等标记"
    }
  ],
  "userMessage": "给用户看的总结话术（中文），若不完整需明确说明缺少什么、如何补全；若完整则简短肯定"
}`;
}
