import OpenAI from "openai";

let openai: OpenAI;

function getOpenAIClient(): OpenAI {
    if (!openai) {
        if (!process.env.DEEPSEEK_API_KEY) {
            throw new Error("Missing DEEPSEEK_API_KEY environment variable");
        }

        openai = new OpenAI({
            baseURL: "https://api.deepseek.com",
            apiKey: process.env.DEEPSEEK_API_KEY,
        });
    }

    return openai;
}

type DeepSeekOptions = {
    /**
     * 是否使用思考模式（deepseek-reasoner），默认 false 使用 deepseek-chat
     */
    useReasoner?: boolean;
    /**
     * 最大输出 tokens，默认 6000，防止 8 周计划被截断
     */
    maxTokens?: number;
};

/**
 * 调用 DeepSeek API 生成内容
 */
export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {},
): Promise<string> {
    const {
        useReasoner = false,
        maxTokens = 6000,
    } = options;

    const completion = await getOpenAIClient().chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: useReasoner ? "deepseek-reasoner" : "deepseek-chat",
        max_tokens: maxTokens,
        // 强制返回 JSON，避免 markdown 包裹导致截断或解析失败
        response_format: { type: "json_object" },
        temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("DeepSeek API 返回空内容");
    }

    // 调试：仅输出前 2000 字，避免日志爆炸
    console.debug(
        `[deepseek] raw content len=${content.length}, preview=${content.slice(
            0,
            2000,
        )}`,
    );

    return content;
}

/**
 * 解析 DeepSeek 返回的 JSON 响应
 * 清理可能包含的 markdown 代码块标记，并增加兜底解析
 */
export function parseJsonResponse<T>(text: string, debugLabel = "deepseek"): T {
    // 清理 markdown 代码块标记
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

        // 兜底：截取首尾大括号尝试解析，防止尾部被截断的 markdown
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

