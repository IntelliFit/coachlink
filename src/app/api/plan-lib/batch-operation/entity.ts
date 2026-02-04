/**
 * 批量操作的请求和响应类型定义
 */

// 请求参数
export interface BatchOperationDto {
    // 训练计划模板ID
    templateId: string;
    // 用户的自然语言指令
    instruction: string;
}

// 修改差异信息
export interface ModificationDiff {
    dayIndex: number;
    actionName: string;
    field: string;
    oldValue: any;
    newValue: any;
}

// SSE 流式响应的数据格式
export type SSEMessage =
    | { type: 'progress'; message: string }  // 进度信息（包括重试信息）
    | { type: 'action_plan'; plan: string }  // 执行计划(用户友好)
    | { type: 'stats'; tokenUsage?: { prompt: number; completion: number; total: number }; duration?: number }  // 统计信息(开发模式)
    | { type: 'preview_result'; success: boolean; originalTrainingDays: any; updatedTrainingDays: any; modifications: ModificationDiff[]; message: string }  // 预览结果(不保存)
    | { type: 'error'; message: string };  // 错误信息（用户友好格式）
