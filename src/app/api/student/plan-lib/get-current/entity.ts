export interface GetCurrentDto {
    // 无需参数，自动获取当前登录用户的 active 计划
}

export interface GetCurrentResponseDto {
    instance: any | null;
    actions?: Record<string, any>;
    message?: string;
}
