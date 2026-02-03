import { SSEMessage } from '@/app/api/plan-lib/batch-operation/entity';

/**
 * 批量操作服务
 */
export class BatchOperationService {
    /**
     * 执行批量操作并通过回调处理 SSE 消息
     */
    static async executeBatchOperation(
        templateId: string,
        instruction: string,
        onMessage: (message: SSEMessage) => void,
        onComplete: () => void,
        onError: (error: string) => void
    ): Promise<void> {
        try {
            const response = await fetch('/api/plan-lib/batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    templateId,
                    instruction,
                }),
            });

            if (!response.ok) {
                throw new Error('请求失败');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法读取响应流');
            }

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    onComplete();
                    break;
                }

                // 解码数据
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = line.slice(6); // 移除 "data: " 前缀
                            const message = JSON.parse(data) as SSEMessage;
                            onMessage(message);

                            // 如果是错误消息,触发错误回调
                            if (message.type === 'error') {
                                onError(message.message);
                            }
                        } catch (e) {
                            console.error('解析 SSE 消息失败:', e);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('批量操作失败:', error);
            onError(error.message || '操作失败');
        }
    }
}
