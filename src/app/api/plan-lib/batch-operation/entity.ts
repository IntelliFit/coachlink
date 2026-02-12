/**
 * 批量操作的请求和响应类型定义
 */

// 多轮对话单条（助手追问 + 用户补充）
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

// 请求参数
export interface BatchOperationDto {
    // 训练计划模板ID
    templateId: string;
    // 用户首轮自然语言指令
    instruction: string;
    // 多轮对话历史（助手追问与用户补充），用于 need_clarification 后的续写
    conversationHistory?: ConversationTurn[];
}

// 修改差异信息
export interface ModificationDiff {
    dayIndex: number;
    actionName: string;
    field: string;
    oldValue: any;
    newValue: any;
}

// AI 意图类型
export type AIIntent = 'query' | 'modify';

// 修改计划中检测到的不在动作库中的动作
export interface NewActionDetected {
    actionId: string;
    suggestedName?: string;  // 来自 params.action_name 或 actionPlan 的推断
}

// SSE 流式响应的数据格式
export type SSEMessage =
    | { type: 'progress'; message: string }  // 进度信息（包括重试信息）
    | { type: 'action_plan'; plan: string }  // 执行计划(用户友好)
    | { type: 'need_clarification'; question: string; suggestions?: string[] }  // 指令信息不完整，需用户补全；suggestions 为推荐选项供前端展示
    | { type: 'new_actions_detected'; actions: NewActionDetected[]; message: string }  // 计划中含动作库外动作，询问是否创建
    | { type: 'stats'; tokenUsage?: { prompt: number; completion: number; total: number }; duration?: number }  // 统计信息(开发模式)
    | { type: 'preview_result'; success: boolean; originalTrainingDays: any; updatedTrainingDays: any; modifications: ModificationDiff[]; message: string }  // 预览结果(不保存)
    | { type: 'query_result'; answer: string }  // 查询结果（AI 直接回答）
    | { type: 'error'; message: string };  // 错误信息（用户友好格式）
