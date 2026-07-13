import OpenAI from "openai";

/** 万界方舟 OpenAI 兼容接口；SDK 会在此地址后追加 /chat/completions。 */
export const WANJIE_ARK_DEFAULT_BASE_URL = "https://maas-openapi.wanjiedata.com/api/v1";

export type CoachlinkLlmProvider = "wanjie-ark";

type WanjieModelKind = "default" | "plan" | "coachReply" | "vision" | "fast";

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
    return {
        client: new OpenAI({
            baseURL: getWanjieBaseUrl(),
            apiKey: getRequiredEnv("WANJIE_ARK_API_KEY"),
            // SDK 默认会在连接断开后长时间重试；业务层做一次快速、可见的重试。
            maxRetries: 0,
            timeout: 45_000,
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
