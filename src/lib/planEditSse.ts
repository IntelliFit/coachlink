import type { SSEMessage } from '@/app/api/plan-lib/batch-operation/entity';

const HEARTBEAT_INTERVAL_MS = 15_000;

/** Keep long AI requests alive, and stop work when the response is cancelled. */
export function createPlanEditSseResponse(
    requestSignal: AbortSignal,
    run: (context: {
        sendMessage: (message: SSEMessage) => void;
        signal: AbortSignal;
    }) => Promise<void>,
    formatError: (error: unknown) => string,
): Response {
    const encoder = new TextEncoder();
    const cancellation = new AbortController();
    let cancelStream: (() => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let heartbeat: ReturnType<typeof setInterval> | undefined;

            const close = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                requestSignal.removeEventListener('abort', cancel);
                // reader.cancel() may have already closed the controller.
                try { controller.close(); } catch { /* Already closed. */ }
            };
            const cancel = () => {
                cancellation.abort();
                close();
            };
            cancelStream = cancel;

            const enqueue = (data: string): boolean => {
                if (closed || cancellation.signal.aborted) return false;
                try {
                    controller.enqueue(encoder.encode(data));
                    return true;
                } catch {
                    cancel();
                    return false;
                }
            };
            const sendMessage = (message: SSEMessage) => {
                cancellation.signal.throwIfAborted();
                if (!enqueue(`data: ${JSON.stringify(message)}\n\n`)) {
                    throw new DOMException('AI response stream closed', 'AbortError');
                }
            };

            requestSignal.addEventListener('abort', cancel, { once: true });
            if (requestSignal.aborted) {
                cancel();
                return;
            }

            // SSE comments keep the proxy active without adding progress entries.
            enqueue(': connected\n\n');
            heartbeat = setInterval(() => enqueue(': heartbeat\n\n'), HEARTBEAT_INTERVAL_MS);
            heartbeat.unref?.();

            void Promise.resolve()
                .then(() => {
                    cancellation.signal.throwIfAborted();
                    return run({ sendMessage, signal: cancellation.signal });
                })
                .catch((error: unknown) => {
                    if (cancellation.signal.aborted) return;
                    console.error('[batch-operation] Error:', error);
                    enqueue(`data: ${JSON.stringify({ type: 'error', message: formatError(error) })}\n\n`);
                })
                .finally(close);
        },
        cancel() {
            cancelStream?.();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
