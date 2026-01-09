import OpenAI from "openai";

/**
 * OpenAI client for general AI API calls
 * Uses OpenAI's API directly (not DeepSeek)
 */
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
