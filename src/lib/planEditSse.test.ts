import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlanEditSseResponse } from './planEditSse';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('AI plan SSE connection lifecycle', () => {
    it('keeps emitting heartbeats while the model takes longer than the proxy timeout', async () => {
        vi.useFakeTimers();
        const response = createPlanEditSseResponse(new AbortController().signal, async ({ sendMessage }) => {
            await new Promise((resolve) => setTimeout(resolve, 65_000));
            sendMessage({ type: 'query_result', answer: '完整结果' });
        }, String);
        expect(response.headers.get('X-Accel-Buffering')).toBe('no');
        const result = response.text();
        await vi.advanceTimersByTimeAsync(65_000);
        const text = await result;
        expect(text.match(/: heartbeat/g)).toHaveLength(4);
        expect(text).toContain('完整结果');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts pending work and removes the heartbeat when the reader disconnects', async () => {
        vi.useFakeTimers();
        const started = vi.fn();
        const cancelled = vi.fn();
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        const response = createPlanEditSseResponse(new AbortController().signal, async ({ signal, sendMessage }) => {
            started();
            await new Promise<void>((resolve) => signal.addEventListener('abort', () => {
                cancelled(); resolve();
            }, { once: true }));
            sendMessage({ type: 'query_result', answer: '不能续写' });
        }, String);
        const reader = response.body!.getReader();
        await reader.read();
        await Promise.resolve();
        expect(started).toHaveBeenCalledOnce();
        await reader.cancel();
        await vi.advanceTimersByTimeAsync(65_000);
        expect(cancelled).toHaveBeenCalledOnce();
        expect(errorLog).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start a request already aborted before streaming', async () => {
        const request = new AbortController();
        request.abort();
        const run = vi.fn();
        const response = createPlanEditSseResponse(request.signal, run, String);
        expect(await response.text()).toBe('');
        expect(run).not.toHaveBeenCalled();
    });

    it('closes on request abort even when the consumer did not cancel its reader', async () => {
        vi.useFakeTimers();
        const request = new AbortController();
        let workSignal: AbortSignal | undefined;
        const response = createPlanEditSseResponse(request.signal, async ({ signal }) => {
            workSignal = signal;
            await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
        }, String);
        const result = response.text();
        await Promise.resolve();
        request.abort();
        await result;
        expect(workSignal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('sends a final business error and clears the timer on model failure', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const response = createPlanEditSseResponse(new AbortController().signal, async () => {
            throw new Error('model timeout');
        }, () => '模型服务超时，请重试');
        expect(await response.text()).toContain('"type":"error","message":"模型服务超时，请重试"');
        expect(vi.getTimerCount()).toBe(0);
    });
});
