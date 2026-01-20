import { CoachActionRow } from "@/types";
import { IntensityConfig } from "@/types/intensity";

// 阶段2：解析模板请求
export interface ParseTemplateDto {
    text: string;
    actions: CoachActionRow[];
}

// 解析出的模板动作
export interface ParsedTemplateAction {
    actionId: string;
    sets: number | null;
    reps: number | null;
    durationSeconds?: number | null;
    restSeconds?: number;
    intensityConfig?: IntensityConfig | null;
    note?: string;
}

// 解析出的训练日
export interface ParsedTemplateDay {
    weekIndex: number;
    dayOfWeek: number;
    type: "training" | "rest";
    actions: ParsedTemplateAction[];
    dayNote?: string;
}

// 阶段2：解析模板响应
export interface ParseTemplateResponseDto {
    weeks: number;
    trainingDays: ParsedTemplateDay[];
}

// Gemini 返回的原始模板结构
export interface GeminiParsedTemplate {
    weeks: number;
    trainingDays: {
        weekIndex: number;
        dayOfWeek: number;
        type: "training" | "rest";
        actions: {
            actionId: string;
            sets: number | null;
            reps: number | null;
            durationSeconds?: number | null;
            restSeconds?: number;
            intensityConfig?: {
                relativeIntensity?: {
                    type: "rm" | "percentage";
                    value: number;
                };
                fixedWeight?: {
                    value: number;
                    unit: "kg" | "lbs";
                };
            } | null;
            note?: string;
        }[];
        dayNote?: string;
    }[];
}
