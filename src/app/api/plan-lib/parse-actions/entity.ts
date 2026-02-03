import { CoachActionRow } from "@/types";

// 阶段1：解析动作请求
export interface ParseActionsDto {
    text: string;
}

// 解析出的动作信息
export interface ParsedActionInfo {
    name: string;
    matchedExistingId: string | null;
    needsAutoCompute: boolean;
    includesBodyWeight: boolean;
    attrs: string[];
    type: "STRENGTH" | "CARDIO" | "DIET" | "HABIT";
    isNew: boolean;
}

// 阶段1：解析动作响应
export interface ParseActionsResponseDto {
    actions: ParsedActionInfo[];
}

// Gemini 返回的原始动作数据结构
export interface GeminiParsedAction {
    name: string;
    matchedExistingId: string | null;
    needsAutoCompute: boolean;
    includesBodyWeight: boolean;
    attrs: string[];
    type: "STRENGTH" | "CARDIO" | "DIET" | "HABIT";
}
