import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * 调用 Gemini API 生成内容
 * @param prompt 提示词
 * @returns 生成的文本内容
 */
export async function callGemini(prompt: string): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
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
