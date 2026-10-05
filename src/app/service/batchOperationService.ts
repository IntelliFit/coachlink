import type {
    SSEMessage,
    ConversationTurn,
    BatchOperationContextOptions,
} from '@/app/api/plan-lib/batch-operation/entity';

const INCOMPLETE_RESPONSE_MESSAGE = 'AI 连接中断，本轮修改尚未生成完整预览，未应用到计划。请重新提交原修改要求。';

function formatStreamError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || '操作失败');
    if (/network\s*error|failed to fetch|fetch failed|load failed|terminated|connection.*(?:closed|reset)|abort/i.test(message)) {
        return INCOMPLETE_RESPONSE_MESSAGE;
    }
    return message;
}

/**
 * 批量操作服务
 */
export class BatchOperationService {
    /**
     * 执行批量操作并通过回调处理 SSE 消息
     * @param conversationHistory 当前消息之前的完整多轮对话历史
     */
    static async executeBatchOperation(
        templateId: string,
        instruction: string,
        onMessage: (message: SSEMessage) => void,
        onComplete: () => void,
        onError: (error: string) => void,
        conversationHistory?: ConversationTurn[],
        targetActionType: 'coach' | 'student' = 'coach',
        contextOptions?: BatchOperationContextOptions,
        previewInputOnly = false,
        editEngine: 'code' | 'plan_script' | 'auto' = 'auto',
        modificationContext?: import('@/app/api/plan-lib/batch-operation/entity').ModificationDiff[]
    ): Promise<void> {
        try {
            const body: Record<string, unknown> = {
                templateId,
                instruction,
                targetActionType,
                editEngine,
            };
            if (contextOptions) {
                body.contextOptions = contextOptions;
            }
            if (previewInputOnly) {
                body.previewInputOnly = true;
            }
            if (conversationHistory && conversationHistory.length > 0) {
                body.conversationHistory = conversationHistory;
            }
            if (modificationContext && modificationContext.length > 0) {
                body.modificationContext = modificationContext;
            }
            const response = await fetch('/api/plan-lib/batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            await this.consumeResponse(response, onMessage, onComplete, onError, previewInputOnly);
        } catch (error: any) {
            console.error('批量操作失败:', error);
            onError(formatStreamError(error));
        }
    }

    /**
     * local 模式：直接基于前端当前 trainingDays 预览批量操作
     */
    static async executeBatchOperationLocal(
        trainingDays: any[],
        instruction: string,
        onMessage: (message: SSEMessage) => void,
        onComplete: () => void,
        onError: (error: string) => void,
        conversationHistory?: ConversationTurn[],
        targetActionType: 'coach' | 'student' = 'coach',
        contextOptions?: BatchOperationContextOptions,
        previewInputOnly = false,
        editEngine: 'code' | 'plan_script' | 'auto' = 'auto',
        modificationContext?: import('@/app/api/plan-lib/batch-operation/entity').ModificationDiff[]
    ): Promise<void> {
        try {
            const body: Record<string, unknown> = {
                trainingDays,
                instruction,
                targetActionType,
                editEngine,
            };
            if (contextOptions) {
                body.contextOptions = contextOptions;
            }
            if (previewInputOnly) {
                body.previewInputOnly = true;
            }
            if (conversationHistory && conversationHistory.length > 0) {
                body.conversationHistory = conversationHistory;
            }
            if (modificationContext && modificationContext.length > 0) {
                body.modificationContext = modificationContext;
            }
            const response = await fetch('/api/plan-lib/batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            await this.consumeResponse(response, onMessage, onComplete, onError, previewInputOnly);
        } catch (error: any) {
            console.error('本地批量操作失败:', error);
            onError(formatStreamError(error));
        }
    }

    private static async consumeResponse(
        response: Response,
        onMessage: (message: SSEMessage) => void,
        onComplete: () => void,
        onError: (error: string) => void,
        previewInputOnly: boolean,
    ): Promise<void> {
        if (!response.ok) {
            const text = await response.text();
            let message: string | undefined;
            try {
                const payload = JSON.parse(text);
                if (typeof payload.message === 'string') message = payload.message;
            } catch { /* Proxy error pages are not user-facing messages. */ }
            throw new Error(message || `AI 服务请求失败（HTTP ${response.status}），请稍后重新提交修改要求。`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error(INCOMPLETE_RESPONSE_MESSAGE);
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedResult = false;
        let receivedError = false;
        const handleMessage = (message: SSEMessage) => {
            if (
                message.type === 'preview_result' || message.type === 'query_result' ||
                message.type === 'need_clarification' ||
                (previewInputOnly && message.type === 'ai_input_snapshot')
            ) receivedResult = true;
            onMessage(message);
        };
        const handleError = (message: string) => {
            if (receivedError) return;
            receivedError = true;
            onError(message);
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    buffer += decoder.decode();
                    if (buffer.trim()) this.processBuffer(buffer, handleMessage, handleError);
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) this.processLine(line, handleMessage, handleError);
            }
        } catch (error) {
            // A connection failure after the final result must not discard it or
            // overwrite an already-reported server error with a transport error.
            if (!receivedResult && !receivedError) throw error;
        } finally {
            reader.releaseLock();
        }

        if (!receivedResult && !receivedError) throw new Error(INCOMPLETE_RESPONSE_MESSAGE);
        if (!receivedError) onComplete();
    }

    /**
     * 处理单行 SSE 数据
     */
    private static processLine(
        line: string,
        onMessage: (message: SSEMessage) => void,
        onError: (error: string) => void
    ): void {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            return;
        }

        try {
            const data = trimmedLine.slice(6); // 移除 "data: " 前缀
            
            // 检查数据是否为空
            if (!data.trim()) {
                return;
            }

            // 尝试解析 JSON
            const message = JSON.parse(data) as SSEMessage;
            
            // 验证消息格式
            if (!message.type) {
                console.warn('收到无效的 SSE 消息（缺少 type 字段）:', data);
                return;
            }

            // SSE 业务错误只走 onError，避免 onMessage + onError 各记录一次。
            if (message.type === 'error') {
                onError(message.message);
                return;
            }

            onMessage(message);
        } catch (e: any) {
            // 详细的错误日志
            console.error('解析 SSE 消息失败:', {
                error: e.message,
                line: line.substring(0, 200), // 只显示前200个字符
                position: e.message.match(/position (\d+)/)?.[1] || 'unknown'
            });
            
            // 不中断流程，继续处理后续消息
        }
    }

    /**
     * 处理缓冲区中剩余的数据
     */
    private static processBuffer(
        buffer: string,
        onMessage: (message: SSEMessage) => void,
        onError: (error: string) => void
    ): void {
        const lines = buffer.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            this.processLine(line, onMessage, onError);
        }
    }
}
