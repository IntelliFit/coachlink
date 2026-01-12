export interface CreateGrowthShareDto {
    /** 关联的训练执行记录，可选 */
    executionId?: string;
}

export interface CreateGrowthShareResponseDto {
    shareId: string;
    /** 用于生成二维码的落地页链接（/s/<shareId>） */
    acquisitionUrl: string;
    /** 过期时间（ISO），用于前端展示 */
    expiresAt: string;
}

