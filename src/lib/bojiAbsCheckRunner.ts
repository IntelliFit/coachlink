import { getCoachlinkVisionLlm } from '@/lib/coachlinkLlm';
import { ABS_COUNT_PROMPT, type AskAbsModel } from '@/lib/bojiAbsCheck';

/**
 * 用万界方舟的视觉模型（WANJIE_ARK_VISION_MODEL）回答腹肌问题。
 * 通义系列关闭思考（实测 2–5 秒，开着要 14 秒）。失败、超时都返回 null，不抛错。
 * 不加系统提示：加「严谨、不恭维」那句后，验证集没腹肌判对率从 14/18 降到 12/18。
 */
export function createVisionAbsAsker(timeoutMs: number, prompt: string = ABS_COUNT_PROMPT): AskAbsModel {
  return async (cropBase64) => {
    try {
      const { client, model } = getCoachlinkVisionLlm();
      const body = {
        model,
        temperature: 0,
        max_tokens: 500,
        ...(/^qwen/i.test(model) ? { enable_thinking: false } : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cropBase64}` } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      };
      // enable_thinking 是通义的扩展参数，不在 OpenAI SDK 的类型里
      const completion = await client.chat.completions.create(body as never, { timeout: timeoutMs });
      return (completion as { choices?: Array<{ message?: { content?: string | null } }> }).choices?.[0]?.message?.content ?? null;
    } catch (error) {
      console.warn('[boji/ai-abs] vision call failed:', error instanceof Error ? error.message : 'unknown error');
      return null;
    }
  };
}
