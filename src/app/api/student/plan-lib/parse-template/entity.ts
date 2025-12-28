// 解析模板请求参数
export interface ParseStudentTemplateDto {
    text: string;
    actions: {
        id: string;
        name: string;
    }[];
}

// Gemini 解析的单个动作
interface ParsedAction {
    actionId: string;
    sets: number;
    reps: number;
    restSeconds?: number;
    intensityConfig?: {
        relativeIntensity?: {
            type: "rm" | "percentage";
            value: number;
        };
        fixedWeight?: number;
    } | null;
    note?: string;
}

// 解析后的训练日
export interface ParsedTemplateDay {
    weekIndex: number;
    dayOfWeek: number;
    type: "training" | "rest";
    actions: ParsedAction[];
    dayNote?: string;
}

// Gemini 返回的模板结构
export interface GeminiParsedTemplate {
    weeks: number;
    trainingDays: ParsedTemplateDay[];
}

// 解析模板响应
export interface ParseStudentTemplateResponseDto {
    weeks: number;
    trainingDays: ParsedTemplateDay[];
}
