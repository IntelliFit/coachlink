import {
    COACHLINK_DEFAULT_DEEPSEEK_MODEL,
    getCoachlinkPlanLlm,
} from "@/lib/coachlinkLlm";

type DeepSeekOptions = {
    /**
 * 是否使用思考模式（仅 DeepSeek 直连时有效）
     */
    useReasoner?: boolean;
    /**
     * 最大输出 tokens，默认 6000，防止 8 周计划被截断
     */
    maxTokens?: number;
};

/**
 * 调用 LLM 生成 JSON（计划纯文本链路默认优先 DeepSeek v4-flash）
 */
export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {},
): Promise<string> {
    const {
        useReasoner = false,
        maxTokens = 6000,
    } = options;

    const { client, model, provider } = getCoachlinkPlanLlm();
    const resolvedModel =
        provider === "deepseek" ? COACHLINK_DEFAULT_DEEPSEEK_MODEL : model;

    // Ofox / Gemini 兼容层常只认 max_completion_tokens；仅传 max_tokens 时可能被压成极小上限，导致 JSON 半截
    const body: Parameters<typeof client.chat.completions.create>[0] =
        provider === "ofox"
            ? ({
                  messages: [{ role: "user", content: prompt }],
                  model: resolvedModel,
                  max_tokens: maxTokens,
                  max_completion_tokens: maxTokens,
                  response_format: { type: "json_object" },
                  temperature: 0.2,
              } as Parameters<typeof client.chat.completions.create>[0])
            : ({
                  messages: [{ role: "user", content: prompt }],
                  model: resolvedModel,
                  max_tokens: maxTokens,
                  response_format: { type: "json_object" },
                  temperature: 0.2,
                  ...(useReasoner
                      ? {
                            thinking: { type: "enabled" },
                            reasoning_effort: "high",
                        }
                      : {}),
              } as Parameters<typeof client.chat.completions.create>[0]);

    const completion = await client.chat.completions.create(body);

    const choice = completion.choices[0];
    const content = choice?.message?.content;
    if (!content) {
        throw new Error("LLM 返回空内容");
    }

    const finishReason = choice?.finish_reason;
    const usage = completion.usage;
    if (finishReason === "length") {
        console.warn(
            `[coachlink-llm] finish_reason=length：输出被截断（请求 max≈${maxTokens}，completion_tokens=${usage?.completion_tokens ?? "?"}）。若 JSON 不完整，请增大调用处 maxTokens 或为 Ofox 检查 max_completion_tokens。`,
        );
    }

    console.debug(
        `[coachlink-llm] provider=${provider} model=${resolvedModel} finish_reason=${finishReason ?? "?"} usage=${usage ? JSON.stringify(usage) : "?"} raw len=${content.length}, preview=${content.slice(
            0,
            2000,
        )}`,
    );

    return content;
}

/**
 * 对话生成（自然语言，非 JSON）
 */
export async function callDeepSeekChat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
    const { maxTokens = 2000, temperature = 0.7 } = options;

    const { client, model } = getCoachlinkLlm();

    const completion = await client.chat.completions.create({
        messages,
        model,
        max_tokens: maxTokens,
        temperature,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("LLM 返回空内容");
    }

    console.debug(`[coachlink-llm] chat response len=${content.length}`);
    return content;
}

export function parseJsonResponse<T>(text: string, debugLabel = "deepseek"): T {
    const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error(
            `[${debugLabel}] JSON parse failed:`,
            err,
            "cleaned preview=",
            cleaned.slice(0, 2000),
        );

        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
            const fallback = cleaned.slice(first, last + 1);
            try {
                return JSON.parse(fallback);
            } catch (err2) {
                console.error(
                    `[${debugLabel}] fallback parse failed:`,
                    err2,
                    "fallback preview=",
                    fallback.slice(0, 2000),
                );
            }
        }

        throw err;
    }
}
