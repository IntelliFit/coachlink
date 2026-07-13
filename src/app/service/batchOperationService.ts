import {
    SSEMessage,
    ConversationTurn,
    BatchOperationContextOptions,
} from '@/app/api/plan-lib/batch-operation/entity';

/**
 * 批量操作服务
 */
export class BatchOperationService {
    /**
     * 执行批量操作并通过回调处理 SSE 消息
     * @param conversationHistory 多轮对话历史（助手追问 + 用户补充），用于 need_clarification 后的续写
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
        editEngine: 'code' | 'plan_script' | 'auto' = 'code'
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
            const response = await fetch('/api/plan-lib/batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || '请求失败');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法读取响应流');
            }

            const decoder = new TextDecoder();
            let buffer = ''; // 用于缓存不完整的数据

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    // 处理缓冲区中剩余的数据
                    if (buffer.trim()) {
                        this.processBuffer(buffer, onMessage, onError);
                    }
                    onComplete();
                    break;
                }

                // 解码数据并添加到缓冲区
                buffer += decoder.decode(value, { stream: true });
                
                // 按行分割处理
                const lines = buffer.split('\n');
                
                // 保留最后一个可能不完整的行
                buffer = lines.pop() || '';

                // 处理完整的行
                for (const line of lines) {
                    this.processLine(line, onMessage, onError);
                }
            }
        } catch (error: any) {
            console.error('批量操作失败:', error);
            onError(error.message || '操作失败');
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
        editEngine: 'code' | 'plan_script' | 'auto' = 'code'
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
            const response = await fetch('/api/plan-lib/batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || '请求失败');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法读取响应流');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    if (buffer.trim()) {
                        this.processBuffer(buffer, onMessage, onError);
                    }
                    onComplete();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    this.processLine(line, onMessage, onError);
                }
            }
        } catch (error: any) {
            console.error('本地批量操作失败:', error);
            onError(error.message || '操作失败');
        }
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
