import { getCoachlinkLlm } from "@/lib/coachlinkLlm";

/**
 * 调用 Gemini API 生成内容
 * @param prompt 提示词
 * @returns 生成的文本内容
 */
export async function callGemini(prompt: string): Promise<string> {
    const { client, model } = getCoachlinkLlm();
    const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("万界方舟返回空内容");
    }
    return content;
}

/**
 * 解析 Gemini 返回的 JSON 响应
 * 清理可能包含的 markdown 代码块标记
 */
export function parseJsonResponse<T>(text: string): T {
    // 清理 markdown 代码块标记
    const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    return JSON.parse(cleaned);
}
