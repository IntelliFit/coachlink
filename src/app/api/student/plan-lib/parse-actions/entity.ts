// 解析动作请求参数
export interface ParseStudentActionsDto {
    text: string;
}

// Gemini 返回的解析动作结构
export interface GeminiParsedAction {
    name: string;
    matchedExistingId: string | null;
    needsAutoCompute: boolean;
    includesBodyWeight: boolean;
    attrs: string[];
}

// 解析后的动作信息
export interface ParsedStudentActionInfo extends GeminiParsedAction {
    isNew: boolean;
}

// 解析动作响应
export interface ParseStudentActionsResponseDto {
    actions: ParsedStudentActionInfo[];
}
