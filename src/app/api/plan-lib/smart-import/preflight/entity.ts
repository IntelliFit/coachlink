// 预检请求
export interface PreflightDto {
    text: string;
}

// 预检响应
export interface PreflightMissingItem {
    scope: "global" | "day" | "action";
    where?: string;
    field?: string;
    reason?: string;
    exampleFix?: string;
}

export interface PreflightResponseDto {
    isComplete: boolean;
    canProceed: boolean;
    missing: PreflightMissingItem[];
    userMessage: string;
}
