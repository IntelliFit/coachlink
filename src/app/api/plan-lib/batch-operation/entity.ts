/**
 * 批量操作的请求和响应类型定义
 */
import type { ItemType } from "@/types";

// 多轮对话单条（助手追问 + 用户补充）
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

// 上下文增强选项（用于给 AI 注入更多“计划外”背景信息）
export interface BatchOperationContextOptions {
    // 教练给学员改计划时，传订阅ID可读取学员档案/问卷/执行记录
    subscriptionId?: string;
    // 各类上下文开关（默认按页面预设）
    includeStudentProfile?: boolean;
    includeStudentQuestionnaire?: boolean;
    includeExecutionHistory?: boolean;
    includeStudentActionLib?: boolean;
    includeCoachActionLib?: boolean;
    includePublicActionLib?: boolean;
    includeCoachTemplates?: boolean;
    includeTemplateMatch?: boolean;
    includeFeedbacks?: boolean;
}

// 请求参数
export interface BatchOperationDto {
    // 训练计划模板ID
    templateId?: string;
    // local 模式可直接传入当前编辑中的 trainingDays
    trainingDays?: any[];
    // 用户首轮自然语言指令
    instruction: string;
    // 目标动作库类型：教练/学员
    targetActionType?: 'coach' | 'student';
    // 上下文增强选项
    contextOptions?: BatchOperationContextOptions;
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

// 预览阶段待人工确认的动作候选
export interface PendingActionCandidate {
    // 修改结果中出现的临时 actionId（不在当前动作库）
    tempActionId: string;
    // 供 UI 展示与默认新建名
    suggestedName: string;
    // 建议类型（可由人工改）
    suggestedType: ItemType;
    // 建议属性模板（可由人工改）
    suggestedAttrs: string[];
    // 出现在哪些 dayIndex（1-based）
    sourceDayIndexes: number[];
    // 该临时动作在计划中出现次数
    occurrences: number;
}

// SSE 流式响应的数据格式
export type SSEMessage =
    | { type: 'progress'; message: string }  // 进度信息（包括重试信息）
    | { type: 'context_applied'; enabled: string[]; unavailable?: string[]; message: string } // 本次实际使用的上下文回执
    | { type: 'action_plan'; plan: string }  // 执行计划(用户友好)
    | { type: 'need_clarification'; question: string; suggestions?: string[] }  // 指令信息不完整，需用户补全；suggestions 为推荐选项供前端展示
    | { type: 'new_actions_detected'; actions: NewActionDetected[]; message: string }  // 计划中含动作库外动作，询问是否创建
    | { type: 'stats'; tokenUsage?: { prompt: number; completion: number; total: number }; duration?: number }  // 统计信息(开发模式)
    | { type: 'preview_result'; success: boolean; originalTrainingDays: any; updatedTrainingDays: any; modifications: ModificationDiff[]; pendingActions?: PendingActionCandidate[]; message: string }  // 预览结果(不保存)
    | { type: 'query_result'; answer: string }  // 查询结果（AI 直接回答）
    | { type: 'error'; message: string };  // 错误信息（用户友好格式）
