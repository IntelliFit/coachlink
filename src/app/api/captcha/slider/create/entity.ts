export interface SliderCreateDto {
    // no body
}

export interface SliderCreateResponseDto {
    id: string;
    trackWidth: number;
    /** 带缺口标记的验证图 URL（由后端根据随机 target 生成，不暴露答案） */
    imageUrl: string;
    /** 兼容旧版，可选 */
    backgroundImage?: string;
}
