import { afterEach, describe, expect, it, vi } from 'vitest';
import { BatchOperationService } from './batchOperationService';

const encoder = new TextEncoder();
const event = (message: object) => `data: ${JSON.stringify(message)}\n\n`;

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function consume(response: Response, local = true, previewInputOnly = false) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = vi.fn();
    const complete = vi.fn();
    const error = vi.fn();
    if (local) {
        await BatchOperationService.executeBatchOperationLocal([], '修改计划', message, complete, error,
            undefined, 'coach', undefined, previewInputOnly);
    } else {
        await BatchOperationService.executeBatchOperation('template-id', '修改计划', message, complete, error,
            undefined, 'coach', undefined, previewInputOnly);
    }
    return { message, complete, error };
}

describe('AI plan streaming results', () => {
    it.each([true, false])('rejects a clean but incomplete response (local=%s)', async (local) => {
        const result = await consume(new Response(': heartbeat\n\n' + event({ type: 'progress', message: '3/4' })), local);
        expect(result.complete).not.toHaveBeenCalled();
        expect(result.error).toHaveBeenCalledOnce();
        expect(result.error.mock.calls[0][0]).toContain('尚未生成完整预览');
    });

    it('ignores heartbeats and preserves a fragmented UTF-8 final result', async () => {
        const bytes = encoder.encode(': heartbeat\n\n' + event({ type: 'query_result', answer: '完整修改结果' }));
        const result = await consume(new Response(new ReadableStream({
            start(controller) {
                for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
                controller.close();
            },
        })));
        expect(result.message).toHaveBeenCalledOnce();
        expect(result.message).toHaveBeenCalledWith({ type: 'query_result', answer: '完整修改结果' });
        expect(result.complete).toHaveBeenCalledOnce();
        expect(result.error).not.toHaveBeenCalled();
    });

    it('reports a server business error once even if the transport then breaks', async () => {
        let reads = 0;
        const result = await consume(new Response(new ReadableStream({
            pull(controller) {
                if (reads++ === 0) controller.enqueue(encoder.encode(event({ type: 'error', message: '模型请求超时' })));
                else controller.error(new Error('network error'));
            },
        })));
        expect(result.error).toHaveBeenCalledOnce();
        expect(result.error).toHaveBeenCalledWith('模型请求超时');
        expect(result.complete).not.toHaveBeenCalled();
    });

    it('keeps a complete result when the connection breaks after delivering it', async () => {
        let reads = 0;
        const result = await consume(new Response(new ReadableStream({
            pull(controller) {
                if (reads++ === 0) controller.enqueue(encoder.encode(event({ type: 'query_result', answer: '已完成' })));
                else controller.error(new Error('network error'));
            },
        })));
        expect(result.complete).toHaveBeenCalledOnce();
        expect(result.error).not.toHaveBeenCalled();
    });

    it('gives a useful error for a broken response rather than raw network error', async () => {
        const result = await consume(new Response(new ReadableStream({
            start(controller) { controller.error(new TypeError('network error')); },
        })));
        expect(result.error).toHaveBeenCalledOnce();
        expect(result.error.mock.calls[0][0]).toContain('请重新提交原修改要求');
        expect(result.complete).not.toHaveBeenCalled();
    });

    it('accepts input-only preview and clarification as valid terminal responses', async () => {
        const input = await consume(new Response(event({ type: 'ai_input_snapshot', fixedInjected: [] })), true, true);
        expect(input.complete).toHaveBeenCalledOnce();
        expect(input.error).not.toHaveBeenCalled();
        const clarify = await consume(new Response(event({ type: 'need_clarification', question: '改哪一天？' })));
        expect(clarify.complete).toHaveBeenCalledOnce();
        expect(clarify.error).not.toHaveBeenCalled();
    });

    it('does not expose a proxy HTML error page as an application message', async () => {
        const result = await consume(new Response('<html>Gateway timeout</html>', { status: 504 }));
        expect(result.error).toHaveBeenCalledOnce();
        expect(result.error).toHaveBeenCalledWith('AI 服务请求失败（HTTP 504），请稍后重新提交修改要求。');
    });
});
