import { loadEnvConfig } from "@next/env";
import OpenAI from "openai";

/** OfoxAI OpenAI 兼容端点（见 https://docs.ofox.ai ） */
const OFOXAI_BASE_URL = "https://api.ofox.ai/v1";

/**
 * 与 `next dev` 使用同一套 .env 加载顺序（.env* / .env.local）。
 * 部分环境下仅 `import` 的模块会在 Next 注入 env 之前执行，导致 OFOXAI_* 读不到。
 */
let didLoadNextEnv = false;
function ensureNextEnvLoaded(): void {
    if (didLoadNextEnv || typeof window !== "undefined") return;
    didLoadNextEnv = true;
    try {
        loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
    } catch {
        /* ignore */
    }
}

/**
 * 智能导入、计划 AI 修改等共用 LLM 客户端。
 *
 * - OFOXAI_API_KEY（或别名 OFOX_API_KEY）：通用 OpenAI 兼容后备（主要给多模态/兼容链路）
 * - OFOXAI_MODEL：默认 `google/gemini-3.1-flash-lite-preview`（见 Ofox Models；若 .env 仍写旧 id 会覆盖默认值）
 * - COACHLINK_USE_DEEPSEEK=1：在同时配置了 DEEPSEEK 时强制走 DeepSeek（省成本/省 reasoning tokens）
 * 未配置 Ofox 时回退 DEEPSEEK_API_KEY + deepseek-v4-flash
 */
export const COACHLINK_DEFAULT_OFOX_MODEL = "google/gemini-3.1-flash-lite-preview";
export const COACHLINK_DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

/** 去掉 # 注释、误粘贴的中文/空白，避免请求里出现非法 model id（会 404） */
function sanitizeLlmModelId(raw: string | undefined): string {  
    let s = (raw ?? "").trim();
    if (!s) return COACHLINK_DEFAULT_OFOX_MODEL;
    s = s.split("#")[0]?.trim() ?? s;
    s = s.replace(/[\u4e00-\u9fff]+/g, "").trim();
    s = s.split(/\s+/)[0] ?? s;
    return s || COACHLINK_DEFAULT_OFOX_MODEL;
}

export type CoachlinkLlmProvider = "ofox" | "deepseek";

/** 支持主名 + 别名，避免 .env 里手误后静默回退 DeepSeek */
function getOfoxApiKey(): string | undefined {
    const raw =
        process.env.OFOXAI_API_KEY ?? process.env.OFOX_API_KEY;
    const k = raw?.trim();
    return k || undefined;
}

let devEnvLogged = false;

function preferDeepSeekOverOfox(): boolean {
    const v = process.env.COACHLINK_USE_DEEPSEEK?.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
}

export function getCoachlinkLlm(): {
    client: OpenAI;
    model: string;
    provider: CoachlinkLlmProvider;
} {
    ensureNextEnvLoaded();

    const ofoxKey = getOfoxApiKey();
    const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
    const forceDs = preferDeepSeekOverOfox() && Boolean(deepseekKey);

    if (process.env.NODE_ENV === "development" && !devEnvLogged) {
        devEnvLogged = true;
        const hasOfox = Boolean(ofoxKey);
        const hasDs = Boolean(deepseekKey);
        const envModelRaw = process.env.OFOXAI_MODEL;
        const effective = ofoxKey && !forceDs
            ? sanitizeLlmModelId(envModelRaw ?? COACHLINK_DEFAULT_OFOX_MODEL)
            : COACHLINK_DEFAULT_DEEPSEEK_MODEL;
        console.info(
            `[coachlinkLlm] cwd=${process.cwd()} OFOXAI_API_KEY=${hasOfox ? "set" : "missing"}, DEEPSEEK_API_KEY=${hasDs ? "set" : "missing"}, COACHLINK_USE_DEEPSEEK=${forceDs ? "on" : "off"}`,
        );
        console.info(
            `[coachlinkLlm] model: OFOXAI_MODEL env=${envModelRaw ? `"${envModelRaw.slice(0, 40)}${envModelRaw.length > 40 ? "…" : ""}"` : "(unset)"} → effective=${effective}`,
        );
        if (hasOfox && envModelRaw?.includes("gemini-3-flash-preview") && !envModelRaw.includes("lite")) {
            console.info(
                `[coachlinkLlm] 提示：当前 OFOXAI_MODEL 为满血 Flash，reasoning_tokens 可能很高；可改为 ${COACHLINK_DEFAULT_LLM_MODEL} 或删掉 OFOXAI_MODEL 用默认 Lite。`,
            );
        }
    }

    if (forceDs) {
        return {
            client: new OpenAI({
                baseURL: "https://api.deepseek.com",
                apiKey: deepseekKey!,
            }),
            model: COACHLINK_DEFAULT_DEEPSEEK_MODEL,
            provider: "deepseek",
        };
    }

    if (ofoxKey) {
        const model = sanitizeLlmModelId(
            process.env.OFOXAI_MODEL ?? COACHLINK_DEFAULT_OFOX_MODEL,
        );
        return {
            client: new OpenAI({
                baseURL: OFOXAI_BASE_URL,
                apiKey: ofoxKey,
            }),
            model,
            provider: "ofox",
        };
    }

    if (!deepseekKey) {
        throw new Error(
            `请配置 OFOXAI_API_KEY（后备，默认模型 ${COACHLINK_DEFAULT_OFOX_MODEL}）或 DEEPSEEK_API_KEY（推荐，默认模型 ${COACHLINK_DEFAULT_DEEPSEEK_MODEL}）；或设 COACHLINK_USE_DEEPSEEK=1 强制 DeepSeek`,
        );
    }

    return {
        client: new OpenAI({
            baseURL: "https://api.deepseek.com",
            apiKey: deepseekKey,
        }),
        model: COACHLINK_DEFAULT_DEEPSEEK_MODEL,
        provider: "deepseek",
    };
}

/**
 * 计划生成 / 计划解析 / 计划修改等纯文本链路，默认优先使用 DeepSeek v4-flash。
 * 只有在 DeepSeek key 缺失时，才回退通用 LLM 配置。
 */
export function getCoachlinkPlanLlm(): {
    client: OpenAI;
    model: string;
    provider: CoachlinkLlmProvider;
} {
    ensureNextEnvLoaded();

    const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (deepseekKey) {
        return {
            client: new OpenAI({
                baseURL: "https://api.deepseek.com",
                apiKey: deepseekKey,
            }),
            model: COACHLINK_DEFAULT_DEEPSEEK_MODEL,
            provider: "deepseek",
        };
    }

    return getCoachlinkLlm();
}
