import OpenAI from "openai";

/** 万界方舟 OpenAI 兼容接口；SDK 会在此地址后追加 /chat/completions。 */
export const WANJIE_ARK_DEFAULT_BASE_URL = "https://maas-openapi.wanjiedata.com/api/v1";
export const WANJIE_ARK_DEFAULT_ANTHROPIC_MESSAGES_URL =
    "https://maas-openapi.wanjiedata.com/api/anthropic/v1/messages";

export type CoachlinkLlmProvider = "wanjie-ark";

type WanjieModelKind = "default" | "plan" | "planScript" | "coachReply" | "vision" | "fast";

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`缺少 ${name}。请在 Apollo（或当前选择的本地业务配置文件）中配置万界方舟大模型参数。`);
    }
    return value;
}

function getWanjieBaseUrl(): string {
    return (process.env.WANJIE_ARK_BASE_URL?.trim() || WANJIE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getWanjieModel(kind: WanjieModelKind): string {
    const override =
        kind === "plan"
            ? process.env.WANJIE_ARK_PLAN_MODEL?.trim()
            : kind === "planScript"
                ? process.env.WANJIE_ARK_PLAN_SCRIPT_MODEL?.trim() || "deepseek-v4-flash"
            : kind === "coachReply"
                ? process.env.WANJIE_ARK_COACH_REPLY_MODEL?.trim()
                : kind === "vision"
                    ? process.env.WANJIE_ARK_VISION_MODEL?.trim()
                    : kind === "fast"
                        ? process.env.WANJIE_ARK_FAST_MODEL?.trim() || "deepseek-v4-flash"
                : undefined;
    return override || getRequiredEnv("WANJIE_ARK_MODEL");
}

function createWanjieLlm(kind: WanjieModelKind) {
    const timeout = kind === "planScript"
        ? 120_000
        : kind === "plan" || kind === "vision"
            ? 90_000
            : 45_000;
    return {
        client: new OpenAI({
            baseURL: getWanjieBaseUrl(),
            apiKey: getRequiredEnv("WANJIE_ARK_API_KEY"),
            // SDK 默认会在连接断开后长时间重试；业务层做一次快速、可见的重试。
            maxRetries: 0,
            timeout,
        }),
        model: getWanjieModel(kind),
        provider: "wanjie-ark" as const,
    };
}

/** 通用文本、多模态兼容链路使用的万界方舟客户端。 */
export function getCoachlinkLlm() {
    return createWanjieLlm("default");
}

/** 计划生成、解析和修改使用；可通过 WANJIE_ARK_PLAN_MODEL 单独指定模型。 */
export function getCoachlinkPlanLlm() {
    return createWanjieLlm("plan");
}

/** 长计划脚本需输出完整周期，默认使用更快的 Flash 并放宽超时。 */
export function getCoachlinkPlanScriptLlm() {
    return createWanjieLlm("planScript");
}

export interface WanjieAnthropicTextResult {
    content: string;
    inputTokens: number;
    outputTokens: number;
}

/**
 * 万界方舟 Anthropic 端点作为长计划脚本的故障隔离通道。
 * 当前 Key 对应的无 stable 后缀模型可用；默认 Sonnet 4.6。
 */
export function getCoachlinkPlanScriptFallbackLlm() {
    const model = process.env.WANJIE_ARK_PLAN_SCRIPT_FALLBACK_MODEL?.trim() || "claude-sonnet-4-6";
    const messagesUrl = (
        process.env.WANJIE_ARK_ANTHROPIC_MESSAGES_URL?.trim() ||
        WANJIE_ARK_DEFAULT_ANTHROPIC_MESSAGES_URL
    ).replace(/\/+$/, "");
    const apiKey = getRequiredEnv("WANJIE_ARK_API_KEY");

    return {
        model,
        provider: "wanjie-ark-anthropic" as const,
        async createText(params: {
            prompt: string;
            maxTokens?: number;
            timeoutMs?: number;
        }): Promise<WanjieAnthropicTextResult> {
            const response = await fetch(messagesUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model,
                    max_tokens: params.maxTokens || 1800,
                    temperature: 0,
                    messages: [{ role: "user", content: params.prompt }],
                }),
                signal: AbortSignal.timeout(params.timeoutMs || 60_000),
            });
            const raw = await response.text();
            let payload: any = null;
            try {
                payload = JSON.parse(raw);
            } catch {
                // 由下面的统一错误处理报告原始响应。
            }
            if (!response.ok) {
                const detail = payload?.error?.message || payload?.error || raw.trim() || `HTTP ${response.status}`;
                throw new Error(`万界方舟 Anthropic 计划脚本请求失败（${response.status}）：${detail}`);
            }

            const content = Array.isArray(payload?.content)
                ? payload.content
                    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
                    .map((item: any) => item.text)
                    .join("")
                    .trim()
                : "";
            if (!content) throw new Error("万界方舟 Anthropic 计划脚本请求未返回文本");
            return {
                content,
                inputTokens: Number(payload?.usage?.input_tokens || 0),
                outputTokens: Number(payload?.usage?.output_tokens || 0),
            };
        },
    };
}

/** 教练 AI 自动回复使用；可通过 WANJIE_ARK_COACH_REPLY_MODEL 单独指定模型。 */
export function getCoachlinkCoachReplyLlm() {
    return createWanjieLlm("coachReply");
}

/** 含图片输入的功能使用，当前用于计划图片智能导入。 */
export function getCoachlinkVisionLlm() {
    return createWanjieLlm("vision");
}

/** 意图判断、完整性检查等短任务使用，避免 Pro 模型将小输出预算全部用于 reasoning。 */
export function getCoachlinkFastLlm() {
    return createWanjieLlm("fast");
}
