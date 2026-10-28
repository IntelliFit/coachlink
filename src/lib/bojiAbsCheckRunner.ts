import { getCoachlinkVisionLlm } from '@/lib/coachlinkLlm';
import { ABS_CHECK_PROMPT, ABS_CHECK_SYSTEM, type AskAbsModel } from '@/lib/bojiAbsCheck';

/**
 * 用万界方舟的视觉模型回答腹肌复核问题。model 为空时用 WANJIE_ARK_VISION_MODEL。
 * 通义系列关闭思考（实测约 5 秒，开着要 14 秒）。失败、超时都返回 null，不抛错。
 */
export function createVisionAbsAsker(timeouts: { timeoutMs: number; confirmTimeoutMs: number }): AskAbsModel {
  return async (cropBase64, model) => {
    const timeoutMs = model ? timeouts.confirmTimeoutMs : timeouts.timeoutMs;
    try {
      const { client, model: visionModel } = getCoachlinkVisionLlm();
      const use = model || visionModel;
      const body = {
        model: use,
        temperature: 0,
        max_tokens: 300,
        ...(/^qwen/i.test(use) ? { enable_thinking: false } : {}),
        messages: [
          { role: 'system', content: ABS_CHECK_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: ABS_CHECK_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cropBase64}` } },
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
